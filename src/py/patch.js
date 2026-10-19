export const PY_PATCH = `
import shutil, warnings
try:
    import pyodide._package_loader as _pl
    shutil.register_unpack_format("pq_wheel", [".whl.wasm"], shutil._unpack_zipfile)
    _pl.ZIP_TYPES = frozenset(_pl.ZIP_TYPES) | {".wasm"}
except Exception:
    pass
warnings.filterwarnings("ignore", message=".*pyarrow.*")
`;
