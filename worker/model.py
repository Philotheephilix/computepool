from __future__ import annotations

import gc
import logging
from typing import Any, Optional, Tuple

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from transformers.cache_utils import DynamicCache

logger = logging.getLogger(__name__)


class SplitModel:
    def __init__(
        self,
        model_name: str,
        role: str,
        layers: Tuple[int, int],
        device: str = "cpu",
        dtype: torch.dtype = torch.bfloat16,
    ) -> None:
        if role not in ("entry", "exit"):
            raise ValueError(f"role must be 'entry' or 'exit', got {role!r}")
        if not (
            isinstance(layers, (tuple, list))
            and len(layers) == 2
            and 0 <= int(layers[0]) <= int(layers[1])
        ):
            raise ValueError(f"layers must be (start, end_inclusive), got {layers}")

        self.model_name = model_name
        self.role = role
        self.layer_start, self.layer_end = int(layers[0]), int(layers[1])
        self.device = torch.device(device)
        self.dtype = dtype

        self.tokenizer = None
        self.config = None

        self.embed_tokens: Optional[torch.nn.Module] = None
        self.layers: Optional[torch.nn.ModuleList] = None
        self.norm: Optional[torch.nn.Module] = None
        self.lm_head: Optional[torch.nn.Module] = None

        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return

        logger.info(
            "loading model=%s role=%s layers=[%d,%d) dtype=%s device=%s",
            self.model_name,
            self.role,
            self.layer_start,
            self.layer_end,
            self.dtype,
            self.device,
        )

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)

        full = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            torch_dtype=self.dtype,
            low_cpu_mem_usage=True,
        )
        full.eval()
        self.config = full.config

        decoder = getattr(full, "model", None)
        if decoder is None:
            raise RuntimeError(
                "Could not find `.model` on full causal-LM. "
                "This wrapper only supports Qwen2/Llama-style architectures."
            )

        n_layers = len(decoder.layers)
        if self.layer_end >= n_layers:
            raise ValueError(
                f"layer_end={self.layer_end} >= total layers={n_layers} "
                f"for model {self.model_name}"
            )

        kept_layers = torch.nn.ModuleList(
            [decoder.layers[i] for i in range(self.layer_start, self.layer_end + 1)]
        )

        if self.role == "entry":
            self.embed_tokens = decoder.embed_tokens
            self.layers = kept_layers
        else:
            # Clone tied lm_head weight so the slice survives `del full`.
            lm_head = full.lm_head
            embed_w = getattr(decoder.embed_tokens, "weight", None)
            if embed_w is not None and lm_head.weight.data_ptr() == embed_w.data_ptr():
                logger.info("detaching tied lm_head weight from embed_tokens for exit")
                cloned = lm_head.weight.detach().clone()
                lm_head.weight = torch.nn.Parameter(cloned, requires_grad=False)

            self.layers = kept_layers
            self.norm = decoder.norm
            self.lm_head = lm_head

        for module in (self.embed_tokens, self.layers, self.norm, self.lm_head):
            if module is not None:
                module.to(self.device)
                for p in module.parameters():
                    p.requires_grad_(False)

        del full, decoder
        gc.collect()

        self._loaded = True
        logger.info("model loaded role=%s layers=[%d,%d]", self.role, self.layer_start, self.layer_end)

    def unload(self) -> None:
        if not self._loaded:
            return
        self.embed_tokens = None
        self.layers = None
        self.norm = None
        self.lm_head = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self._loaded = False
        logger.info("model unloaded role=%s", self.role)

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def hidden_size(self) -> int:
        if self.config is None:
            raise RuntimeError("model not loaded")
        return int(self.config.hidden_size)

    @property
    def vocab_size(self) -> int:
        if self.config is None:
            raise RuntimeError("model not loaded")
        return int(self.config.vocab_size)

    def _first_layer_idx(self) -> int:
        # Exit layers retain their original layer_idx (e.g. 18..35); read it
        # off the attention module so DynamicCache lookups hit the right slot.
        if self.layers is None or len(self.layers) == 0:
            return self.layer_start
        first = self.layers[0]
        for path in (("self_attn", "layer_idx"), ("layer_idx",)):
            obj: Any = first
            ok = True
            for attr in path:
                if not hasattr(obj, attr):
                    ok = False
                    break
                obj = getattr(obj, attr)
            if ok and isinstance(obj, int):
                return int(obj)
        return self.layer_start

    def _cache_seq_length(self, past_key_values: DynamicCache) -> int:
        if past_key_values is None or len(past_key_values) == 0:
            return 0
        idx = self._first_layer_idx()
        try:
            return int(past_key_values.get_seq_length(idx))
        except Exception:
            try:
                kc = past_key_values.key_cache
                if idx < len(kc) and kc[idx] is not None and kc[idx].numel() > 0:
                    return int(kc[idx].shape[-2])
            except Exception:
                pass
            return 0

    def _call_layer(
        self,
        layer: torch.nn.Module,
        hidden_states: torch.Tensor,
        position_ids: torch.Tensor,
        cache_position: torch.Tensor,
        past_key_values: DynamicCache,
    ) -> torch.Tensor:
        out = layer(
            hidden_states,
            attention_mask=None,
            position_ids=position_ids,
            past_key_value=past_key_values,
            output_attentions=False,
            use_cache=True,
            cache_position=cache_position,
        )
        if isinstance(out, tuple):
            return out[0]
        return out

    @torch.no_grad()
    def forward_entry(
        self,
        input_ids: torch.Tensor,
        past_key_values: Optional[DynamicCache] = None,
    ) -> Tuple[torch.Tensor, DynamicCache]:
        if not self._loaded or self.role != "entry":
            raise RuntimeError("forward_entry requires a loaded entry model")

        if past_key_values is None:
            past_key_values = DynamicCache()

        if input_ids.dim() != 2 or input_ids.shape[0] != 1:
            raise ValueError(
                f"forward_entry expects [1, seq_len] input_ids, got {tuple(input_ids.shape)}"
            )

        input_ids = input_ids.to(self.device)
        seq_len = input_ids.shape[1]

        past_len = self._cache_seq_length(past_key_values)

        cache_position = torch.arange(
            past_len, past_len + seq_len, device=self.device, dtype=torch.long
        )
        position_ids = cache_position.unsqueeze(0)

        hidden_states = self.embed_tokens(input_ids)

        for layer in self.layers:
            hidden_states = self._call_layer(
                layer,
                hidden_states,
                position_ids=position_ids,
                cache_position=cache_position,
                past_key_values=past_key_values,
            )

        return hidden_states, past_key_values

    @torch.no_grad()
    def forward_exit(
        self,
        hidden_states: torch.Tensor,
        past_key_values: Optional[DynamicCache] = None,
    ) -> Tuple[torch.Tensor, DynamicCache]:
        if not self._loaded or self.role != "exit":
            raise RuntimeError("forward_exit requires a loaded exit model")

        if past_key_values is None:
            past_key_values = DynamicCache()

        if hidden_states.dim() != 3 or hidden_states.shape[0] != 1:
            raise ValueError(
                f"forward_exit expects [1, seq_len, hidden], got {tuple(hidden_states.shape)}"
            )

        hidden_states = hidden_states.to(device=self.device, dtype=self.dtype)
        seq_len = hidden_states.shape[1]

        past_len = self._cache_seq_length(past_key_values)

        cache_position = torch.arange(
            past_len, past_len + seq_len, device=self.device, dtype=torch.long
        )
        position_ids = cache_position.unsqueeze(0)

        for layer in self.layers:
            hidden_states = self._call_layer(
                layer,
                hidden_states,
                position_ids=position_ids,
                cache_position=cache_position,
                past_key_values=past_key_values,
            )

        hidden_states = self.norm(hidden_states)
        logits = self.lm_head(hidden_states)
        return logits, past_key_values


def sample_next_token(
    logits_last: torch.Tensor,
    temperature: float = 0.0,
) -> int:
    if logits_last.dim() != 1:
        raise ValueError(f"expected 1D logits, got shape {tuple(logits_last.shape)}")

    if temperature is None or temperature <= 0.0:
        return int(torch.argmax(logits_last).item())

    scaled = logits_last.to(torch.float32) / float(temperature)
    probs = torch.softmax(scaled, dim=-1)
    next_id = torch.multinomial(probs, num_samples=1)
    return int(next_id.item())


__all__ = ["SplitModel", "sample_next_token"]
