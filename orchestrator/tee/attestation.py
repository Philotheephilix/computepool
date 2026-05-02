"""TEE quote retrieval. Dev mode returns a stub; SGX/TDX require enclave runtime hooks."""
import base64
from typing import Literal

from orchestrator.settings import get_settings
from orchestrator.tee.signer import TEESigner

ReportType = Literal["dev-insecure", "sgx-dcap", "tdx"]


def get_quote(signer: TEESigner) -> tuple[ReportType, str]:
    rt: ReportType = get_settings().tee_report_type  # type: ignore[assignment]
    if rt == "dev-insecure":
        return rt, base64.b64encode(b"DEV-MODE-NO-QUOTE").decode()
    if rt == "sgx-dcap":
        # In a real SGX deployment, call into the platform's DCAP quoting library
        # and bind the report data = keccak(signer.address). This is enclave-runtime
        # specific; wire in your operator's quoting service here.
        raise NotImplementedError("wire DCAP quoting in your enclave runtime")
    if rt == "tdx":
        raise NotImplementedError("wire TDX quoting in your enclave runtime")
    raise ValueError(f"unknown tee_report_type: {rt}")
