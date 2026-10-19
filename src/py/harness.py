import ast
import builtins as _builtins
import datetime as _dt
import hashlib
import io
import json
import math
import os
import random
import re
import sys
import time
import traceback
import warnings

PLAYER_FILE = "<код>"
SETUP_FILE = "<подготовка>"
CALL_FILE = "<вызов>"
STEP_LIMIT = 3_000_000
OUTPUT_LINE_LIMIT = 10_000
WORK_DIR = "/tmp/pq-work"

FORBIDDEN_MODULES = {
    "js", "pyodide", "pyodide_js", "micropip", "urllib", "requests", "socket",
    "subprocess", "http", "ctypes", "importlib", "multiprocessing", "threading",
    "asyncio", "pq_harness", "shutil",
}
FORBIDDEN_CALLS = {"eval", "exec", "compile", "__import__", "globals", "breakpoint", "exit", "quit"}
SPECIFIC = {
    "unpack_int_input", "input_no_int", "assign_in_condition", "print_instead_of_return", "missing_return",
    "method_returns_none", "modify_while_iterating", "input_prompt", "slash_instead_floordiv", "format_whitespace",
    "format_case", "format_commas", "mutable_default", "infinite_loop", "function_missing", "eof",
    "result_missing", "result_type", "columns_mismatch", "shape_rows", "row_order", "array_shape", "axis_confusion",
    "array_dtype", "mask_parentheses", "series_and_or", "inplace_none", "merge_inner", "merge_dupes", "column_key",
    "missing_import", "chained_assignment", "text_reduction", "plot_dims", "seaborn_column", "resample_index", "stat_sided", "stat_decision", "stat_sign", "stat_percent", "stat_nan", "plot_xy_swap", "plot_bins", "plot_kind", "plot_labels", "plot_empty", "too_slow", "column_dtype", "self_missing", "init_typo",
}
SHADOW_NAMES = {"list", "sum", "max", "min", "str", "int", "input", "print", "len", "dict", "set", "float", "range", "sorted", "type", "tuple"}
IMPORT_NAMES = {
    "pd": "import pandas as pd", "np": "import numpy as np", "Counter": "from collections import Counter",
    "defaultdict": "from collections import defaultdict", "namedtuple": "from collections import namedtuple",
    "deque": "from collections import deque", "datetime": "from datetime import datetime", "date": "from datetime import date",
    "timedelta": "from datetime import timedelta", "math": "import math", "itertools": "import itertools",
    "combinations": "from itertools import combinations", "permutations": "from itertools import permutations",
    "dataclass": "from dataclasses import dataclass", "field": "from dataclasses import field", "reduce": "from functools import reduce",
    "statistics": "import statistics", "json": "import json", "csv": "import csv", "re": "import re", "random": "import random",
}
VALUE_TYPES = {"array", "dataframe", "vectorize", "value", "plot", "stat"}
FIG_VAR = "__figure__"


class StepLimit(BaseException):
    pass


class OutputLimit(BaseException):
    pass


class _Out(io.StringIO):
    def write(self, s):
        if self.getvalue().count("\n") + s.count("\n") > OUTPUT_LINE_LIMIT:
            raise OutputLimit()
        return super().write(s)


class _Budget:
    def __init__(self, limit):
        self.left = limit

    def tracer(self, frame, event, arg):
        if frame.f_code.co_filename != PLAYER_FILE:
            return None
        return self._local

    def _local(self, frame, event, arg):
        if event == "line":
            self.left -= 1
            if self.left <= 0:
                raise StepLimit()
        return self._local


def normalize_output(s):
    lines = [line.rstrip() for line in str(s).replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def _module(v):
    return type(v).__module__.split(".")[0]


def _is_np(v):
    return _module(v) == "numpy"


def _is_pd(v):
    return _module(v) == "pandas"


def _num(v):
    if isinstance(v, bool):
        return ("b", v)
    if isinstance(v, int):
        return ("n", v)
    if math.isnan(v):
        return ("nan",)
    if math.isinf(v):
        return ("inf", v > 0)
    if v.is_integer() and abs(v) < 1e15:
        return ("n", int(v))
    r = round(v, 6)
    return ("f", 0.0 if r == 0 else r)


def canon(v, depth=0):
    if depth > 50:
        return ("deep",)
    if isinstance(v, (bool, int, float)):
        return _num(v)
    if isinstance(v, str):
        return ("s", v)
    if v is None:
        return ("none",)
    if isinstance(v, list):
        return ("l", tuple(canon(x, depth + 1) for x in v))
    if isinstance(v, tuple):
        return ("t", tuple(canon(x, depth + 1) for x in v))
    if isinstance(v, dict):
        items = sorted((repr(canon(k, depth + 1)), repr(canon(x, depth + 1))) for k, x in v.items())
        return ("d", tuple(items))
    if isinstance(v, (set, frozenset)):
        return ("set", tuple(sorted(repr(canon(x, depth + 1)) for x in v)))
    if isinstance(v, (_dt.datetime, _dt.date)):
        return ("dt", _date_text(v))
    if hasattr(type(v), "__dataclass_fields__"):
        return ("dc", type(v).__name__, tuple((k, canon(getattr(v, k), depth + 1)) for k in type(v).__dataclass_fields__))
    if _is_np(v):
        import numpy as np
        if isinstance(v, np.ndarray):
            return ("arr", tuple(v.shape), _kind_group(v.dtype.kind), tuple(_cell(x) for x in v.ravel().tolist()))
        if isinstance(v, np.generic):
            return canon(v.item(), depth + 1)
    if _is_pd(v):
        import pandas as pd
        if isinstance(v, (pd.DataFrame, pd.Series)):
            cols, rows = frame_parts(v)
            return ("frame", tuple(cols), tuple(rows))
        if v is pd.NA or v is pd.NaT:
            return ("none",)
        if isinstance(v, pd.Timestamp):
            return ("dt", _date_text(v))
    return ("o", repr(v))


def _date_text(v):
    if isinstance(v, _dt.datetime) or hasattr(v, "hour"):
        if getattr(v, "hour", 0) == 0 and getattr(v, "minute", 0) == 0 and getattr(v, "second", 0) == 0 and getattr(v, "microsecond", 0) == 0:
            return v.strftime("%Y-%m-%d")
        return v.isoformat()
    return v.isoformat()


def _cell(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return ("b", v)
    if isinstance(v, (int, float)):
        if isinstance(v, float) and math.isnan(v):
            return None
        return _num(v)
    if isinstance(v, str):
        return v
    if isinstance(v, (_dt.datetime, _dt.date)):
        return "D:" + _date_text(v)
    if _is_np(v):
        return _cell(v.item())
    if _is_pd(v):
        import pandas as pd
        if v is pd.NA or v is pd.NaT:
            return None
        if isinstance(v, pd.Timestamp):
            return "D:" + _date_text(v)
        if isinstance(v, pd.Timedelta):
            return "T:" + str(v)
        if isinstance(v, pd.Period):
            return "P:" + str(v)
        if isinstance(v, pd.Interval):
            return "I:" + str(v)
    return "O:" + repr(v)


def _kind_group(k):
    return {"b": "bool", "i": "num", "u": "num", "f": "num", "c": "num", "U": "str", "S": "str", "O": "obj", "M": "date", "m": "delta"}.get(k, k)


def frame_parts(obj):
    import pandas as pd
    if isinstance(obj, pd.Series):
        df = obj.to_frame(name=obj.name if obj.name is not None else "value")
    else:
        df = obj
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = ["_".join(str(x) for x in c if str(x) != "") for c in df.columns]
    if any(n is not None for n in df.index.names):
        df = df.reset_index()
    cols = [str(c) for c in df.columns]
    data = [[_cell(x) for x in df.iloc[:, j].tolist()] for j in range(df.shape[1])]
    rows = list(zip(*data)) if data else [() for _ in range(len(df))]
    return cols, rows


def h(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:20]


def hash_value(v):
    return h(repr(canon(v)))


def hash_output(s):
    return h("out:" + normalize_output(s))


def type_name(v):
    names = {bool: "bool", int: "int", float: "float", str: "str", list: "list", tuple: "tuple", dict: "dict", set: "set", type(None): "None"}
    if type(v) in names:
        return names[type(v)]
    if _is_np(v):
        import numpy as np
        if isinstance(v, np.ndarray):
            return "ndarray"
        if isinstance(v, np.bool_):
            return "bool"
        if isinstance(v, np.integer):
            return "int"
        if isinstance(v, np.floating):
            return "float"
    return type(v).__name__


def short_repr(v, limit=300):
    try:
        r = repr(v)
    except Exception:
        r = "<не удалось показать>"
    return r if len(r) <= limit else r[:limit] + "…"


def _cell_text(v):
    if v is None:
        return "None"
    if isinstance(v, float):
        if math.isnan(v):
            return "NaN"
        r = repr(round(v, 6))
        return r[:-2] if r.endswith(".0") and abs(v) >= 1e15 else r
    if _is_np(v):
        return _cell_text(v.item())
    if _is_pd(v):
        import pandas as pd
        if v is pd.NA:
            return "<NA>"
        if v is pd.NaT:
            return "NaT"
        if isinstance(v, pd.Timestamp):
            return _date_text(v)
    s = str(v)
    return s if len(s) <= 80 else s[:80] + "…"


def preview(v, rows=10):
    try:
        if _is_pd(v):
            import pandas as pd
            if isinstance(v, (pd.DataFrame, pd.Series)):
                is_series = isinstance(v, pd.Series)
                df = v.to_frame(name=v.name if v.name is not None else "") if is_series else v
                head = df.head(rows)
                idx_names = [str(n) if n is not None else "" for n in head.index.names]
                cols = [str(c) if not isinstance(c, tuple) else " / ".join(str(x) for x in c) for c in head.columns]
                body = []
                for idx, row in zip(head.index.tolist(), head.itertuples(index=False, name=None)):
                    idx_vals = list(idx) if isinstance(idx, tuple) else [idx]
                    body.append([_cell_text(x) for x in idx_vals] + [_cell_text(x) for x in row])
                dtypes = [str(t) for t in df.dtypes.tolist()]
                return {"kind": "frame", "series": is_series, "index": idx_names, "columns": cols, "rows": body,
                        "shape": list(v.shape) if not is_series else [len(v)], "dtypes": dtypes, "more": len(df) > rows}
            if isinstance(v, pd.Index):
                return {"kind": "value", "type": "Index", "text": short_repr(list(v), 1500)}
        if _is_np(v):
            import numpy as np
            if isinstance(v, np.ndarray):
                text = np.array2string(v, threshold=80, max_line_width=96, edgeitems=4)
                return {"kind": "array", "shape": list(v.shape), "dtype": str(v.dtype), "text": text}
        if _module(v).startswith("matplotlib") or _module(v).startswith("seaborn"):
            return {"kind": "value", "type": type(v).__name__, "text": "график — картинка ниже"}
        return {"kind": "value", "type": type_name(v), "text": short_repr(v, 1500)}
    except Exception as e:
        return {"kind": "value", "type": type(v).__name__, "text": "<не удалось показать: %s>" % e}


class Run:
    def __init__(self):
        self.stdout = ""
        self.error = None
        self.value = None
        self.ns = None
        self.limit = None
        self.warnings = []
        self.ms = 0


def _error_info(exc):
    tb = exc.__traceback__
    line = None
    lib = None
    for frame, lineno in traceback.walk_tb(tb):
        fn = frame.f_code.co_filename
        if fn == PLAYER_FILE:
            line = lineno
        elif "/sklearn/" in fn:
            lib = lib or "sklearn"
        elif "/pandas/" in fn:
            lib = lib or "pandas"
        elif "/numpy/" in fn:
            lib = lib or "numpy"
    text_lines = traceback.format_exception(type(exc), exc, tb)
    shown = []
    keep = False
    for chunk in text_lines:
        if chunk.startswith("Traceback"):
            shown.append(chunk)
            continue
        if PLAYER_FILE in chunk or CALL_FILE in chunk:
            keep = True
            shown.append(chunk)
            continue
        if chunk.startswith("  File "):
            keep = False
            continue
        if keep or not chunk.startswith("  "):
            shown.append(chunk)
    msg = str(exc)
    if len(msg) > 600:
        msg = msg[:600] + "…"
    return {
        "type": type(exc).__name__,
        "msg": msg,
        "line": line,
        "lib": lib,
        "tb": "".join(shown).replace(PLAYER_FILE, "код").replace(CALL_FILE, "проверка"),
    }


def _safe_open(file, mode="r", *args, **kwargs):
    p = str(file)
    if p.startswith("/") or ".." in p.replace("\\", "/").split("/"):
        raise PermissionError("Открывай файлы по имени из рабочей папки задачи, например open('sales.txt')")
    if any(c in mode for c in "wax+") and not os.getcwd().startswith(WORK_DIR):
        raise PermissionError("В этой задаче файлы можно только читать")
    if "b" not in mode and "encoding" not in kwargs and len(args) < 2:
        kwargs["encoding"] = "utf-8"
    return io.open(p, mode, *args, **kwargs)


def _raises(fn):
    try:
        fn()
    except BaseException as e:
        if isinstance(e, (StepLimit, OutputLimit)):
            raise
        return type(e).__name__
    return None


def _make_env(stdin_text, out):
    text = stdin_text or ""
    if not text.endswith("\n"):
        text += "\n"
    stream = io.StringIO(text)

    def _input(prompt=""):
        if prompt:
            out.write(str(prompt))
        line = stream.readline()
        if line == "":
            raise EOFError("EOF when reading a line")
        return line.rstrip("\n").rstrip("\r")

    bdict = dict(_builtins.__dict__)
    bdict["input"] = _input
    bdict["open"] = _safe_open
    for name in ("exit", "quit", "help", "breakpoint"):
        bdict.pop(name, None)
    ns = {"__name__": "__main__", "__builtins__": bdict}
    return ns, stream


class _Dir:
    def __init__(self, path):
        self.path = path
        self.old = None

    def __enter__(self):
        if self.path:
            os.makedirs(self.path, exist_ok=True)
            self.old = os.getcwd()
            os.chdir(self.path)
        return self

    def __exit__(self, *a):
        if self.old:
            os.chdir(self.old)


def _task_dir(task, variant):
    data = (variant or {}).get("data")
    if data:
        return "/data/" + data
    d = WORK_DIR + "/" + re.sub(r"[^A-Za-z0-9_-]", "_", task.get("id", "free"))
    os.makedirs(d, exist_ok=True)
    for name, content in (task.get("files") or {}).items():
        with io.open(os.path.join(d, name), "w", encoding="utf-8") as f:
            f.write(content)
    return d


def execute(code_obj, stdin_text="", budget=None, ns=None, stream=None, out=None):
    run = Run()
    out = out or _Out()
    if ns is None:
        ns, stream = _make_env(stdin_text, out)
    budget = budget or _Budget(STEP_LIMIT)
    old_out, old_in = sys.stdout, sys.stdin
    sys.stdout, sys.stdin = out, stream
    t0 = time.perf_counter()
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        sys.settrace(budget.tracer)
        try:
            exec(code_obj, ns)
        except StepLimit:
            run.limit = "steps"
        except OutputLimit:
            run.limit = "output"
        except SystemExit:
            pass
        except BaseException as exc:
            run.error = _error_info(exc)
        finally:
            sys.settrace(None)
            sys.stdout, sys.stdin = old_out, old_in
    run.ms = (time.perf_counter() - t0) * 1000
    run.warnings = [w.category.__name__ for w in caught]
    run.stdout = out.getvalue()
    run.ns = ns
    return run


def call_in(ns, call_src, budget):
    out = _Out()
    run = Run()
    old_out = sys.stdout
    sys.stdout = out
    sys.settrace(budget.tracer)
    try:
        mod = ast.parse(call_src, CALL_FILE)
        body = mod.body
        if body and isinstance(body[-1], ast.Expr):
            if len(body) > 1:
                exec(compile(ast.Module(body=body[:-1], type_ignores=[]), CALL_FILE, "exec"), ns)
            run.value = eval(compile(ast.Expression(body=body[-1].value), CALL_FILE, "eval"), ns)
        else:
            exec(compile(mod, CALL_FILE, "exec"), ns)
    except StepLimit:
        run.limit = "steps"
    except OutputLimit:
        run.limit = "output"
    except BaseException as exc:
        run.error = _error_info(exc)
    finally:
        sys.settrace(None)
        sys.stdout = old_out
    run.stdout = out.getvalue()
    return run


def parse(code):
    try:
        tree = ast.parse(code, PLAYER_FILE)
        return tree, None
    except SyntaxError as exc:
        return None, {
            "type": type(exc).__name__,
            "msg": exc.msg,
            "line": exc.lineno,
            "col": exc.offset,
            "text": (exc.text or "").rstrip("\n"),
            "tb": "",
        }


def static_violations(tree):
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] in FORBIDDEN_MODULES:
                    found.append({"id": "forbidden_import", "params": {"name": alias.name}, "line": node.lineno})
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] in FORBIDDEN_MODULES:
                found.append({"id": "forbidden_import", "params": {"name": node.module}, "line": node.lineno})
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FORBIDDEN_CALLS:
            found.append({"id": "forbidden_call", "params": {"name": node.func.id}, "line": node.lineno})
        elif isinstance(node, ast.Attribute) and node.attr.startswith("__") and node.attr.endswith("__") and node.attr not in ("__name__", "__doc__", "__init__", "__str__", "__repr__", "__eq__", "__lt__", "__len__", "__dict__", "__class__"):
            found.append({"id": "forbidden_dunder", "params": {"name": node.attr}, "line": node.lineno})
    return found


LOOP_NODES = (ast.For, ast.While, ast.AsyncFor)
COMP_NODES = (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
USES = {
    "comprehension": COMP_NODES,
    "listcomp": (ast.ListComp,),
    "for": (ast.For,),
    "while": (ast.While,),
    "if": (ast.If, ast.IfExp),
    "fstring": (ast.JoinedStr,),
    "slice": (ast.Slice,),
    "def": (ast.FunctionDef,),
    "lambda": (ast.Lambda,),
    "dict": (ast.Dict, ast.DictComp),
    "set": (ast.Set, ast.SetComp),
    "tuple": (ast.Tuple,),
    "break": (ast.Break,),
    "continue": (ast.Continue,),
    "try": (ast.Try,),
    "raise": (ast.Raise,),
    "with": (ast.With,),
    "class": (ast.ClassDef,),
    "yield": (ast.Yield, ast.YieldFrom),
    "elif": (),
}


def _called_names(tree):
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                names.add(node.func.id)
            elif isinstance(node.func, ast.Attribute):
                names.add(node.func.attr)
    return names


def _attr_names(tree):
    return {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}


def _has_elif(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.If) and len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
            return True
    return False


def code_lines(code):
    return [line for line in code.split("\n") if line.strip() and not line.strip().startswith("#")]


def _recursive(tree):
    for fn in ast.walk(tree):
        if isinstance(fn, ast.FunctionDef):
            for n in ast.walk(fn):
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == fn.name:
                    return True
    return False


def check_rule(rule, tree, code):
    kind, _, arg = rule.partition(":")
    if kind == "no_loops":
        return not any(isinstance(n, LOOP_NODES + COMP_NODES) for n in ast.walk(tree))
    if kind == "no_for_while":
        return not any(isinstance(n, LOOP_NODES) for n in ast.walk(tree))
    if kind == "uses":
        if arg == "elif":
            return _has_elif(tree)
        if arg == "recursion":
            return _recursive(tree)
        nodes = USES.get(arg)
        if nodes is None:
            return arg in _called_names(tree) or arg in _attr_names(tree)
        return any(isinstance(n, nodes) for n in ast.walk(tree))
    if kind == "no_call":
        return arg not in _called_names(tree)
    if kind == "no_attr":
        return arg not in _attr_names(tree)
    if kind == "no_import":
        return not any(isinstance(n, (ast.Import, ast.ImportFrom)) for n in ast.walk(tree))
    if kind == "max_lines":
        return len(code_lines(code)) <= int(arg)
    if kind == "no_str":
        return not any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "str" for n in ast.walk(tree))
    if kind == "no_subscript":
        return not any(isinstance(n, ast.Subscript) for n in ast.walk(tree))
    if kind == "first_try":
        return True
    raise ValueError("unknown rule " + rule)


def _input_calls(tree):
    res = []
    parents = {}
    for node in ast.walk(tree):
        for child in ast.iter_child_nodes(node):
            parents[child] = node
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "input":
            res.append((node, parents.get(node)))
    return res, parents


def _input_var_used_numerically(tree, node, parents):
    cur = node
    for _ in range(4):
        cur = parents.get(cur)
        if cur is None:
            return False
        if isinstance(cur, ast.Assign):
            break
    else:
        return False
    if not isinstance(cur, ast.Assign):
        return False
    names = set()
    for t in cur.targets:
        for n in ast.walk(t):
            if isinstance(n, ast.Name):
                names.add(n.id)
    for n in ast.walk(tree):
        if isinstance(n, (ast.BinOp, ast.AugAssign, ast.Compare)):
            for sub in ast.walk(n):
                if isinstance(sub, ast.Name) and sub.id in names:
                    return True
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "range":
            for sub in ast.walk(n):
                if isinstance(sub, ast.Name) and sub.id in names:
                    return True
    return False


def _func_defs(tree):
    return [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]


def _detect_error(err, add):
    et, msg = err["type"], err["msg"]
    line = err.get("line")
    lib = err.get("lib")
    if et == "IndentationError" or et == "TabError":
        add("indentation", line)
    elif et == "SyntaxError":
        text = err.get("text") or ""
        stripped = text.strip()
        if re.match(r"^(if|elif|while)\b.*[^=!<>]=[^=]", stripped) and "==" not in stripped:
            add("assign_in_condition", line)
        elif re.match(r"^(if|elif|else|for|while|def|try|except|finally|with|class)\b", stripped) and not stripped.endswith(":"):
            add("missing_colon", line)
        elif "unterminated string" in msg or "EOL" in msg:
            add("unclosed_string", line)
        elif "was never closed" in msg or "unmatched" in msg or "does not match" in msg:
            add("brackets", line)
        else:
            add("syntax_generic", line)
    elif et == "TypeError":
        if "unsupported operand type(s) for &" in msg or "unsupported operand type(s) for |" in msg or "Cannot perform 'rand_'" in msg or "Cannot perform 'ror_'" in msg or "Cannot perform 'and_'" in msg or "Cannot perform 'or_'" in msg:
            add("mask_parentheses", line)
        elif "can only concatenate str" in msg or "unsupported operand type(s) for +: 'int' and 'str'" in msg:
            add("str_int_concat", line)
        elif "cannot unpack non-iterable int" in msg:
            add("unpack_int_input", line)
        elif "not supported between instances of 'str' and 'int'" in msg or "not supported between instances of 'int' and 'str'" in msg:
            add("input_no_int", line)
        elif "'str' object cannot be interpreted as an integer" in msg:
            add("input_no_int", line)
        elif re.search(r"'(DataFrame|Series)' object is not callable", msg):
            add("df_call", line)
        elif "object is not callable" in msg:
            add("not_callable", line)
        elif "'NoneType'" in msg:
            add("none_value", line)
        elif "missing" in msg and "required positional argument" in msg and "self" in msg:
            add("self_missing", line)
        elif "takes" in msg and "positional argument" in msg and "given" in msg and "." in msg.split("(")[0]:
            add("self_missing", line)
        elif "missing" in msg and "required positional argument" in msg:
            add("missing_argument", line)
        elif "object does not support item assignment" in msg:
            add("immutable_assign", line)
        elif "takes no arguments" in msg or "Object() takes no arguments" in msg:
            add("init_typo", line)
        elif "Data source must be a DataFrame" in msg:
            add("seaborn_column", line)
        elif "Only valid with DatetimeIndex" in msg:
            add("resample_index", line)
        elif "does not support operation" in msg or "agg function failed" in msg or "Cannot perform reduction" in msg:
            add("text_reduction", line)
        else:
            add("err_TypeError", line)
    elif et in ("ValueError", "NotFittedError"):
        if "Found unknown categories" in msg:
            add("unknown_category", line)
        elif "could not convert string to float" in msg and lib == "sklearn":
            add("encode_categorical", line)
        elif "contains NaN" in msg or "Input X contains" in msg:
            add("model_nan", line)
        elif "feature names should match" in msg or "features, but" in msg or "columns are missing" in msg or "Feature names unseen" in msg or "Feature names seen at fit time" in msg:
            add("feature_mismatch", line)
        elif "is not fitted yet" in msg:
            add("not_fitted", line)
        elif "Expected 2D array, got 1D array" in msg or "Expected a 2-dimensional container" in msg:
            add("reshape_2d", line)
        elif "Unknown label type" in msg:
            add("label_type", line)
        elif "invalid literal for int()" in msg:
            add("int_parse", line)
        elif "truth value of a" in msg and "ambiguous" in msg:
            add("series_and_or", line)
        elif "could not be broadcast" in msg:
            add("broadcast_error", line)
        elif "matmul" in msg or "not aligned" in msg:
            add("matmul_shape", line)
        elif "must have same first dimension" in msg or "x and y must be the same size" in msg or "shape mismatch: objects cannot be broadcast" in msg:
            add("plot_dims", line)
        elif "window must be an integer" in msg or "window must be a datetimelike" in msg:
            add("resample_index", line)
        elif "Could not interpret value" in msg or "Could not interpret input" in msg:
            add("seaborn_column", line)
        elif "cannot reshape array" in msg:
            add("reshape_size", line)
        elif "could not convert string to float" in msg:
            add("convert_float", line)
        elif "time data" in msg or "doesn't match format" in msg or "Unknown datetime string format" in msg or "unconverted data remains" in msg:
            add("date_parse", line)
        elif "too many values to unpack" in msg or "not enough values to unpack" in msg:
            add("unpack_count", line)
        elif "Length of values" in msg or "Length mismatch" in msg:
            add("length_mismatch", line)
        else:
            add("err_ValueError", line)
    elif et == "NameError":
        m = re.search(r"name '([^']+)' is not defined", msg)
        name = m.group(1) if m else "?"
        if name in IMPORT_NAMES:
            add("missing_import", line, name=name, stmt=IMPORT_NAMES[name])
        elif name == "self":
            add("self_missing", line)
        else:
            add("name_error", line, name=name)
    elif et == "UnboundLocalError":
        add("unbound_local", line)
    elif et == "EOFError":
        add("eof", line)
    elif et == "ZeroDivisionError":
        add("zero_division", line)
    elif et == "IndexError":
        if "too many indices" in msg:
            add("array_index_dims", line)
        elif "single positional indexer is out-of-bounds" in msg:
            add("iloc_bounds", line)
        else:
            add("index_error", line)
    elif et == "KeyError":
        if lib == "pandas":
            add("column_key", line, key=msg)
        else:
            add("key_error", line, key=msg)
    elif et == "AttributeError":
        m = re.search(r"'(DataFrame|Series|numpy\.ndarray|DataFrameGroupBy|SeriesGroupBy)' object has no attribute '([^']+)'", msg)
        if m:
            add("df_attribute", line, obj=m.group(1).replace("numpy.", ""), name=m.group(2))
        else:
            add("attribute_error", line)
    elif et == "RecursionError":
        add("recursion", line)
    elif et == "FileNotFoundError":
        add("file_not_found", line)
    elif et == "PermissionError":
        add("no_files", line)
    elif et in ("ModuleNotFoundError", "ImportError"):
        add("module_missing", line)
    else:
        add("err_generic", line, type=et)


def detect(tree, code, ctx):
    found = []

    def add(did, line=None, **params):
        if not any(f["id"] == did for f in found):
            found.append({"id": did, "line": line, "params": params})

    err = ctx.get("error")
    wrong = ctx.get("wrong")
    task = ctx.get("task") or {}

    for did, params in ctx.get("diag") or []:
        add(did, None, **params)
    if err:
        _detect_error(err, add)
    if ctx.get("limit") == "steps":
        add("infinite_loop")
    if ctx.get("limit") == "output":
        add("output_flood")
    if ctx.get("limit") == "slow":
        add("too_slow", ms=ctx.get("ms"), limit=ctx.get("max_ms"))
    if ctx.get("missing_function"):
        add("function_missing", name=ctx["missing_function"])
    for w in ctx.get("warnings") or []:
        if w in ("ChainedAssignmentError", "SettingWithCopyWarning"):
            add("chained_assignment")

    failing = bool(err or wrong or ctx.get("limit") or ctx.get("diag"))
    if tree is not None:
        inputs, parents = _input_calls(tree)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Tuple):
                v = node.value
                if isinstance(v, ast.Call) and isinstance(v.func, ast.Name) and v.func.id in ("int", "float") and v.args and isinstance(v.args[0], ast.Call) and getattr(v.args[0].func, "id", None) == "input":
                    if err or wrong:
                        add("unpack_int_input", node.lineno)
        for fn in _func_defs(tree):
            for d in fn.args.defaults + [d for d in fn.args.kw_defaults if d is not None]:
                if isinstance(d, (ast.List, ast.Dict, ast.Set)):
                    add("mutable_default", fn.lineno, name=fn.name)
        for node in ast.walk(tree):
            if isinstance(node, (ast.Assign, ast.AugAssign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                for t in targets:
                    if isinstance(t, ast.Name) and t.id in SHADOW_NAMES:
                        add("shadow_builtin", node.lineno, name=t.id)
            if isinstance(node, (ast.For,)) and isinstance(node.target, ast.Name) and node.target.id in SHADOW_NAMES:
                add("shadow_builtin", node.lineno, name=node.target.id)
            if isinstance(node, ast.FunctionDef):
                for a in node.args.args:
                    if a.arg in SHADOW_NAMES:
                        add("shadow_builtin", node.lineno, name=a.arg)
        for node in ast.walk(tree):
            if isinstance(node, ast.Compare) and any(isinstance(op, (ast.Eq, ast.NotEq)) for op in node.ops):
                for side in [node.left] + list(node.comparators):
                    if isinstance(side, ast.Constant) and isinstance(side.value, float):
                        add("float_eq", node.lineno)
            if isinstance(node, ast.Compare) and any(isinstance(op, (ast.Is, ast.IsNot)) for op in node.ops):
                for side in [node.left] + list(node.comparators):
                    if isinstance(side, ast.Constant) and isinstance(side.value, (int, str)) and not isinstance(side.value, bool):
                        add("is_literal", node.lineno)
            if failing and isinstance(node, ast.Compare):
                for side in [node.left] + list(node.comparators):
                    if isinstance(side, ast.BinOp) and isinstance(side.op, (ast.BitAnd, ast.BitOr)):
                        add("mask_parentheses", node.lineno)
        for node in ast.walk(tree):
            if isinstance(node, ast.For) and isinstance(node.iter, ast.Name):
                lst = node.iter.id
                for sub in ast.walk(node):
                    if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Attribute) and isinstance(sub.func.value, ast.Name) and sub.func.value.id == lst and sub.func.attr in ("remove", "append", "pop", "insert", "clear"):
                        add("modify_while_iterating", node.lineno, name=lst)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.value, ast.Call):
                call = node.value
                if any(k.arg == "inplace" and isinstance(k.value, ast.Constant) and k.value.value is True for k in call.keywords):
                    add("inplace_none", node.lineno)
                elif isinstance(call.func, ast.Attribute) and call.func.attr in ("sort", "append", "reverse", "extend", "insert", "clear") and isinstance(call.func.value, ast.Name):
                    add("method_returns_none", node.lineno, method=call.func.attr)
            if failing and isinstance(node, ast.Assign):
                for t in node.targets:
                    if isinstance(t, ast.Subscript) and isinstance(t.value, ast.Subscript):
                        add("chained_assignment", node.lineno)
        if failing:
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef):
                            if item.name in ("_init_", "__int__", "init", "__init", "_init__", "__innit__"):
                                add("init_typo", item.lineno, name=item.name)
                            if not item.args.args and not item.decorator_list:
                                add("self_missing", item.lineno, name=item.name)
        if ctx.get("returned_none"):
            fn_name = ctx.get("function_name")
            for fn in _func_defs(tree):
                if fn.name == fn_name:
                    has_print = any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "print" for n in ast.walk(fn))
                    has_return = any(isinstance(n, ast.Return) and n.value is not None for n in ast.walk(fn))
                    if has_print and not has_return:
                        add("print_instead_of_return", fn.lineno, name=fn_name)
                    elif not has_return:
                        add("missing_return", fn.lineno, name=fn_name)
        if wrong or (err and err["type"] == "TypeError"):
            for node, _ in inputs:
                cur, converted = node, False
                for _ in range(5):
                    cur = parents.get(cur)
                    if cur is None:
                        break
                    if isinstance(cur, ast.Call) and isinstance(cur.func, ast.Name) and cur.func.id in ("int", "float", "map", "sorted", "list", "len", "set"):
                        converted = True
                        break
                    if isinstance(cur, COMP_NODES + (ast.For,)):
                        converted = True
                        break
                    if isinstance(cur, (ast.Assign, ast.Expr, ast.Return)):
                        break
                if not converted and _input_var_used_numerically(tree, node, parents):
                    add("input_no_int", node.lineno)
        if wrong:
            got, exp = wrong.get("got"), wrong.get("expected")
            if isinstance(got, str) and isinstance(exp, str):
                if got.split() == exp.split() and got != exp:
                    add("format_whitespace")
                elif got.lower() == exp.lower():
                    add("format_case")
                if any(n.args for n, _ in inputs) and exp and got.endswith(exp) and got != exp:
                    add("input_prompt")
                if re.search(r"\d\.\d", got) and not re.search(r"\d\.\d", exp) and any(isinstance(n, ast.BinOp) and isinstance(n.op, ast.Div) for n in ast.walk(tree)):
                    add("slash_instead_floordiv")
                if got.replace(",", "") == exp.replace(",", "") and got != exp:
                    add("format_commas")
                if exp and got and exp.split() and got.split() and len(got.split()) == len(exp.split()) and got.split()[::-1] == exp.split():
                    add("reversed_order")
            if wrong.get("type_mismatch"):
                add("type_mismatch", None, got=wrong["type_mismatch"][0], expected=wrong["type_mismatch"][1])
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "range" and len(node.args) >= 2:
                    if isinstance(node.args[1], ast.Name):
                        add("range_bounds", node.lineno)
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "range" and len(node.args) == 1:
                    if isinstance(node.args[0], ast.Name):
                        add("range_bounds", node.lineno)
        for rule in task.get("detectors") or []:
            when = rule.get("when", "fail")
            if when == "fail" and not failing:
                continue
            if re.search(rule["pattern"], code, re.M):
                add(rule["id"], None, message=rule.get("message", ""))
    return sorted(found, key=lambda f: 0 if f["id"] in SPECIFIC else 1)


def _fresh_budget():
    return _Budget(STEP_LIMIT)


def _compile(code):
    return compile(code, PLAYER_FILE, "exec")


def _fill_gaps_ok(template, code):
    norm = lambda s: "\n".join(l.rstrip() for l in s.strip("\n").split("\n"))
    parts = norm(template).split("___")
    pattern = "^" + "(.+?)".join(re.escape(p) for p in parts) + "$"
    m = re.match(pattern, norm(code), re.S)
    if not m:
        return False, "structure"
    for g in m.groups():
        if "\n" in g or not g.strip() or "___" in g:
            return False, "gap"
    return True, None


def _result(ok, stage, **kw):
    r = {"ok": ok, "stage": stage, "tests": [], "hidden": None, "error": None, "detectors": [], "star3": False, "stdout": "", "limit": None, "rule": None}
    r.update(kw)
    return r


def _kind(task):
    t = task["type"]
    if t in ("stdio", "function", "predict", "model"):
        return t
    if t in VALUE_TYPES:
        return "value"
    return task.get("base", "stdio")


def _prepare_ns(task, variant, out=None, stdin_text="", shuffle=False):
    out = out or _Out()
    ns, stream = _make_env(stdin_text, out)
    ns["raises"] = _raises
    ns["SHUFFLE"] = shuffle
    if variant is not None:
        ns["SEED"] = variant.get("seed", 0)
    setup = task.get("setup")
    if setup:
        old = sys.stdout
        sys.stdout = io.StringIO()
        try:
            exec(compile(setup, SETUP_FILE, "exec"), ns)
        finally:
            sys.stdout = old
    return ns, stream, out


def _frame_expect(v, spec):
    cols, rows = frame_parts(v)
    return _frame_signature(cols, rows, spec)


def _frame_signature(cols, rows, spec):
    order = list(range(len(cols)))
    if spec.get("names", True) and not spec.get("col_order"):
        order = sorted(range(len(cols)), key=lambda j: cols[j])
    cols2 = [cols[j] for j in order]
    rows2 = [tuple(r[j] for j in order) for r in rows]
    sorted_rows = sorted(rows2, key=repr)
    key_cols = cols2 if spec.get("names", True) else [str(i) for i in range(len(cols2))]
    main = rows2 if spec.get("ordered") else sorted_rows
    col_hashes = {}
    kinds = {}
    for j, c in enumerate(key_cols):
        vals = [r[j] for r in rows2]
        col_hashes[c] = h(repr(sorted(vals, key=repr)))
        kinds[c] = _value_kind(vals)
    return {
        "kind": "frame",
        "columns": key_cols,
        "nrows": len(rows2),
        "hash": h(repr((key_cols, main))),
        "sorted_hash": h(repr((key_cols, sorted_rows))),
        "col_hashes": col_hashes,
        "col_kinds": kinds,
    }


def _value_kind(vals):
    kinds = set()
    for v in vals:
        if v is None:
            continue
        if isinstance(v, tuple):
            kinds |= {"bool" if v[0] == "b" else "num"}
        elif isinstance(v, str):
            kinds |= {"date" if v.startswith("D:") else "str"}
        else:
            kinds |= {"other"}
        if len(kinds) > 1:
            break
    return ",".join(sorted(kinds)) or "none"


def _array_signature(a, spec):
    import numpy as np
    a = np.asarray(a)
    kind = a.dtype.kind if spec.get("dtype") == "strict" else _kind_group(a.dtype.kind)
    vals = tuple(_cell(x) for x in a.ravel().tolist())
    return {"kind": "array", "shape": list(a.shape), "dtype": kind, "hash": h(repr((tuple(a.shape), kind, vals))), "vhash": h(repr(vals))}


def _signature(v, spec):
    k = spec["kind"]
    if k == "frame":
        return _frame_expect(v, spec)
    if k == "array":
        return _array_signature(v, spec)
    return {"kind": "value", "hash": hash_value(v), "type": type_name(v)}


def _spec_for(v, task, out_spec):
    spec = {}
    if out_spec.get("var") == FIG_VAR:
        spec = dict(task.get("plot") or {})
        spec["kind"] = "plot"
        return spec
    if "tol" in out_spec or "rtol" in out_spec:
        return {"kind": "num", "tol": out_spec.get("tol"), "rtol": out_spec.get("rtol")}
    if _is_pd(v):
        import pandas as pd
        if isinstance(v, (pd.DataFrame, pd.Series)):
            spec["kind"] = "frame"
            spec["names"] = out_spec.get("names", isinstance(v, pd.DataFrame))
            spec["ordered"] = bool(out_spec.get("ordered", task.get("ordered", False)))
            spec["col_order"] = bool(out_spec.get("col_order", False))
            spec["series"] = isinstance(v, pd.Series)
            return spec
    if _is_np(v):
        import numpy as np
        if isinstance(v, np.ndarray):
            spec["kind"] = "array"
            spec["dtype"] = out_spec.get("dtype", task.get("dtype", "loose"))
            return spec
    spec["kind"] = "value"
    spec["type"] = type_name(v)
    return spec


def _compare(got, spec, exp):
    k = spec["kind"]
    if k == "frame":
        import pandas as pd
        if not isinstance(got, (pd.DataFrame, pd.Series)):
            return False, [("result_type", {"got": type_name(got), "expected": "Series" if spec.get("series") else "DataFrame"})]
        cols, rows = frame_parts(got)
        if spec.get("names", True):
            missing = [c for c in exp["columns"] if c not in cols]
            extra = [c for c in cols if c not in exp["columns"]]
            if missing or extra:
                diag = [("columns_mismatch", {"missing": ", ".join(missing) or "нет", "extra": ", ".join(extra) or "нет"})]
                if len(rows) != exp["nrows"]:
                    diag.append(("shape_rows", {"got": len(rows), "expected": exp["nrows"]}))
                return False, diag
        elif len(cols) != len(exp["columns"]):
            return False, [("columns_count", {"got": len(cols), "expected": len(exp["columns"])})]
        sig = _frame_signature(cols, rows, spec)
        if sig["nrows"] != exp["nrows"]:
            return False, [("shape_rows", {"got": sig["nrows"], "expected": exp["nrows"]})]
        if sig["hash"] == exp["hash"]:
            return True, []
        if spec.get("ordered") and sig["sorted_hash"] == exp["sorted_hash"]:
            return False, [("row_order", {})]
        bad = [c for c in exp["columns"] if sig["col_hashes"].get(c) != exp["col_hashes"].get(c)]
        diag = []
        kinds_bad = [c for c in bad if sig["col_kinds"].get(c) != exp["col_kinds"].get(c) and exp["col_kinds"].get(c) != "none"]
        if kinds_bad:
            c = kinds_bad[0]
            diag.append(("column_dtype", {"col": c if spec.get("names", True) else "№" + str(int(c) + 1), "got": sig["col_kinds"].get(c), "expected": exp["col_kinds"].get(c)}))
        if bad:
            names = ", ".join(bad if spec.get("names", True) else ["№" + str(int(c) + 1) for c in bad])
            diag.append(("column_values", {"cols": names}))
        else:
            diag.append(("row_mismatch", {}))
        return False, diag
    if k == "array":
        import numpy as np
        if not isinstance(got, np.ndarray):
            return False, [("result_type", {"got": type_name(got), "expected": "ndarray"})]
        sig = _array_signature(got, spec)
        if sig["hash"] == exp["hash"]:
            return True, []
        if sig["shape"] != exp["shape"]:
            if len(exp["shape"]) == 2 and sig["shape"] == exp["shape"][::-1]:
                return False, [("axis_confusion", {"got": tuple(sig["shape"]), "expected": tuple(exp["shape"])})]
            if len(sig["shape"]) == 1 and len(exp["shape"]) == 1:
                return False, [("array_shape", {"got": tuple(sig["shape"]), "expected": tuple(exp["shape"])})]
            return False, [("array_shape", {"got": tuple(sig["shape"]), "expected": tuple(exp["shape"])})]
        if sig["dtype"] != exp["dtype"]:
            return False, [("array_dtype", {"got": sig["dtype"], "expected": exp["dtype"]})]
        return False, [("array_values", {})]
    if hash_value(got) == exp["hash"]:
        return True, []
    diag = []
    if type_name(got) != exp.get("type") and got is not None:
        diag.append(("type_mismatch", {"got": type_name(got), "expected": exp.get("type")}))
    if got is None:
        diag.append(("result_none", {}))
    return False, diag


# ---------- графики ----------

def _plt():
    return sys.modules.get("matplotlib.pyplot")


def _close_figs():
    plt = _plt()
    if plt is not None:
        plt.close("all")


def _as_figure(v):
    try:
        import matplotlib.figure as mf
    except Exception:
        return None
    if isinstance(v, mf.Figure):
        return v
    f = getattr(v, "figure", None) or getattr(v, "fig", None)
    if isinstance(f, mf.Figure):
        return f
    if isinstance(v, (list, tuple)) or (_is_np(v) and hasattr(v, "ravel")):
        try:
            for a in (v.ravel() if hasattr(v, "ravel") else v):
                f = getattr(a, "figure", None)
                if isinstance(f, mf.Figure):
                    return f
        except Exception:
            return None
    return None


def _current_figure(ns):
    plt = _plt()
    if plt is None:
        return None
    for name in ("fig", "g", "ax"):
        f = _as_figure(ns.get(name))
        if f is not None:
            return f
    if plt.get_fignums():
        return plt.gcf()
    return None


def _fig_png(fig, dpi=72):
    import base64
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _g(v):
    try:
        f = float(v)
    except Exception:
        return str(v)
    if math.isnan(f):
        return None
    return float("%.5g" % f)


def _is_segment(xy):
    return len(xy) == 2 and (abs(xy[0][0] - xy[1][0]) < 1e-12 or abs(xy[0][1] - xy[1][1]) < 1e-12)


def _tick_map(axis_ticks, labels):
    out = {}
    for t, lab in zip(axis_ticks, labels):
        text = lab.get_text().strip()
        if text:
            out[round(float(t), 4)] = text
    return out


def _axes_summary(ax, fig):
    import numpy as np
    from matplotlib.patches import Rectangle, PathPatch
    from matplotlib.collections import PathCollection
    from matplotlib.container import BarContainer
    kinds = set()
    series, segments, fliers = [], [], []
    for ln in ax.lines:
        if not ln.get_visible():
            continue
        xy = np.asarray(ln.get_xydata(), dtype=float)
        xy = xy[np.isfinite(xy).all(axis=1)] if len(xy) else xy
        if len(xy) == 0:
            continue
        marker_only = str(ln.get_linestyle()) in ("None", "none", "", " ")
        closed = len(xy) >= 4 and np.allclose(xy[0], xy[-1])
        if len(xy) == 1 or _is_segment(xy) or closed:
            segments.append(xy)
            continue
        if marker_only:
            fliers.append(xy)
            continue
        order = np.argsort(xy[:, 0], kind="stable")
        series.append([_g(y) for y in xy[order, 1]])
    xt = _tick_map(ax.get_xticks(), ax.get_xticklabels())
    yt = _tick_map(ax.get_yticks(), ax.get_yticklabels())
    bars = []
    horizontal = False
    for c in ax.containers:
        if isinstance(c, BarContainer):
            horizontal = getattr(c, "orientation", "vertical") == "horizontal"
            for r in c.patches:
                if horizontal:
                    pos, val = r.get_y() + r.get_height() / 2, r.get_width()
                    lab = yt.get(round(pos, 4))
                else:
                    pos, val = r.get_x() + r.get_width() / 2, r.get_height()
                    lab = xt.get(round(pos, 4))
                if not np.isfinite(val):
                    continue
                bars.append((pos, lab, _g(val)))
    if not bars:
        for r in ax.patches:
            if isinstance(r, Rectangle) and r.get_visible() and r.get_width() > 0 and r.get_height() != 0 and r is not ax.patch:
                bars.append((r.get_x() + r.get_width() / 2, xt.get(round(r.get_x() + r.get_width() / 2, 4)), _g(r.get_height())))
    points = []
    for col in ax.collections:
        if isinstance(col, PathCollection):
            off = np.asarray(col.get_offsets(), dtype=float)
            if off.ndim == 2 and len(off):
                off = off[np.isfinite(off).all(axis=1)]
                points.extend((_g(x), _g(y)) for x, y in off)
    has_pathpatch = any(isinstance(pp, PathPatch) for pp in ax.patches)
    box_vals = set()
    if len(segments) >= 5 and (has_pathpatch or not bars):
        kinds |= {"box"}
        for seg in segments + fliers:
            for v in seg[:, 1]:
                box_vals.add(_g(v))
    elif fliers:
        for xy in fliers:
            points.extend((_g(x), _g(y)) for x, y in xy)
        for pp in ax.patches:
            if isinstance(pp, PathPatch):
                for v in pp.get_path().vertices[:, 1]:
                    box_vals.add(_g(v))
    if series:
        kinds |= {"line"}
    if bars:
        widths = sorted(b[0] for b in bars)
        kinds |= {"barh" if horizontal else "bar"}
    if points:
        kinds |= {"scatter"}
    title = ax.get_title() or (fig._suptitle.get_text() if getattr(fig, "_suptitle", None) else "")
    leg = ax.get_legend()
    return {
        "kinds": sorted(kinds),
        "series": sorted(series, key=repr),
        "bars": sorted(((b[1] if b[1] is not None else "", b[2]) for b in bars), key=repr),
        "bar_seq": [b[2] for b in sorted(bars, key=lambda b: b[0])],
        "bar_pos": [_g(b[0]) for b in sorted(bars, key=lambda b: b[0])],
        "points": sorted(points, key=repr),
        "box": sorted(x for x in box_vals if x is not None),
        "title": bool(title.strip()),
        "xlabel": bool(ax.get_xlabel().strip()),
        "ylabel": bool(ax.get_ylabel().strip()),
        "legend": bool(leg is not None and any(t.get_text().strip() for t in leg.get_texts())),
    }


def plot_summary(fig):
    fig.canvas.draw()
    axes = [ax for ax in fig.axes if ax.get_label() != "<colorbar>" and (ax.lines or ax.patches or ax.collections or ax.containers)]
    return {"kind": "plot", "axes": [_axes_summary(ax, fig) for ax in axes]}


KIND_RU = dict(line="линейный", bar="столбчатый", barh="горизонтальные столбцы", scatter="точечный", box="ящик с усами")


def _compare_plot(got, spec, exp):
    if got is not None:
        got = json.loads(json.dumps(got, default=str))
    exp = json.loads(json.dumps(exp, default=str))
    if got is None or not got.get("axes"):
        return False, [("plot_empty", {})]
    ga, ea = got["axes"], exp["axes"]
    if len(ga) != len(ea):
        return False, [("plot_axes", {"got": len(ga), "expected": len(ea)})]
    for i, (g, e) in enumerate(zip(ga, ea)):
        where = " на графике %d" % (i + 1) if len(ea) > 1 else ""
        need = [k for k in e["kinds"] if k not in g["kinds"]]
        if need:
            return False, [("plot_kind", {"got": ", ".join(KIND_RU.get(k, k) for k in g["kinds"]) or "ничего", "expected": ", ".join(KIND_RU.get(k, k) for k in e["kinds"]), "where": where})]
        if spec.get("data", True):
            if "line" in e["kinds"]:
                if len(g["series"]) != len(e["series"]):
                    return False, [("plot_series", {"got": len(g["series"]), "expected": len(e["series"]), "where": where})]
                if g["series"] != e["series"]:
                    lens_g = sorted(len(x) for x in g["series"])
                    lens_e = sorted(len(x) for x in e["series"])
                    if lens_g != lens_e:
                        return False, [("plot_count", {"what": "точек на линии", "got": ", ".join(map(str, lens_g)), "expected": ", ".join(map(str, lens_e)), "where": where})]
                    return False, [("plot_data", {"what": "значения линии", "where": where})]
            if "bar" in e["kinds"] or "barh" in e["kinds"]:
                if len(g["bars"]) != len(e["bars"]):
                    d = ("plot_bins" if spec.get("hist") else "plot_count")
                    return False, [(d, {"what": "столбцов", "got": len(g["bars"]), "expected": len(e["bars"]), "where": where})]
                if spec.get("hist") and g["bar_seq"] == e["bar_seq"] and g.get("bar_pos") and e.get("bar_pos"):
                    if any(abs(a - b) > 1e-4 * max(1.0, abs(b)) for a, b in zip(g["bar_pos"], e["bar_pos"])):
                        return False, [("plot_data", {"what": "границы корзин — проверь, по каким значениям и в каких единицах строишь", "where": where})]
                if spec.get("hist") or spec.get("ordered"):
                    if g["bar_seq"] != e["bar_seq"]:
                        if sorted(g["bar_seq"], key=repr) == sorted(e["bar_seq"], key=repr) and not spec.get("hist"):
                            return False, [("plot_order", {"where": where})]
                        return False, [("plot_data", {"what": "высоты столбцов", "where": where})]
                else:
                    gb = g["bars"] if all(b[0] for b in e["bars"]) else sorted([("", b[1]) for b in g["bars"]], key=repr)
                    eb = e["bars"] if all(b[0] for b in e["bars"]) else sorted([("", b[1]) for b in e["bars"]], key=repr)
                    if gb != eb:
                        return False, [("plot_data", {"what": "высоты столбцов", "where": where})]
            if "scatter" in e["kinds"]:
                if len(g["points"]) != len(e["points"]):
                    return False, [("plot_count", {"what": "точек", "got": len(g["points"]), "expected": len(e["points"]), "where": where})]
                gp = sorted(tuple(p) for p in g["points"])
                ep = sorted(tuple(p) for p in e["points"])
                if gp != ep:
                    sw = sorted((p[1], p[0]) for p in gp)
                    if sw == ep:
                        return False, [("plot_xy_swap", {"where": where})]
                    return False, [("plot_data", {"what": "координаты точек", "where": where})]
            if "box" in e["kinds"] and g["box"] != e["box"]:
                return False, [("plot_data", {"what": "квартили и усы", "where": where})]
        if spec.get("labels", True):
            miss = [n for n, k in (("заголовок", "title"), ("подпись оси X", "xlabel"), ("подпись оси Y", "ylabel")) if e.get(k) and not g.get(k)]
            if miss:
                return False, [("plot_labels", {"missing": ", ".join(miss), "where": where})]
        if spec.get("legend") and e.get("legend") and not g.get("legend"):
            return False, [("plot_legend", {"where": where})]
    return True, []


# ---------- числа с допуском ----------

def _obf_key(task_id, var):
    d = hashlib.sha256(("pq-num:%s:%s" % (task_id, var)).encode()).digest()
    return 1.5 + d[0] / 97.0, (d[1] - 128) / 3.0


def _num_list(v):
    if _is_np(v) and hasattr(v, "tolist"):
        v = v.tolist()
    if isinstance(v, (list, tuple)):
        out = []
        for x in v:
            r = _num_list(x)
            if r is None:
                return None
            out.extend(r)
        return out
    if isinstance(v, bool):
        return None
    try:
        f = float(v)
    except Exception:
        return None
    return [f]


def _num_signature(v, spec, task_id, var):
    vals = _num_list(v)
    k, c = _obf_key(task_id, var)
    return {"kind": "num", "n": len(vals) if vals else 0, "enc": [x * k + c for x in vals] if vals else None, "type": type_name(v)}


def _compare_num(got, spec, exp, task_id, var):
    vals = _num_list(got)
    if vals is None:
        if got is None:
            return False, [("result_none", {})]
        return False, [("type_mismatch", {"got": type_name(got), "expected": "число" if exp["n"] == 1 else "числа"})]
    if len(vals) != exp["n"]:
        return False, [("stat_count", {"got": len(vals), "expected": exp["n"]})]
    k, c = _obf_key(task_id, var)
    want = [(float(x) - c) / k for x in exp["enc"]]
    tol = float(spec.get("tol", 0) or 0)
    rtol = float(spec.get("rtol", 0) or 0)
    bad = []
    for g, w in zip(vals, want):
        if math.isnan(g):
            return False, [("stat_nan", {})]
        lim = max(tol, rtol * abs(w), 1e-9)
        if abs(g - w) > lim:
            bad.append((g, w))
    if not bad:
        return True, []
    g, w = bad[0]
    diag = []
    if w and abs(g - 2 * w) <= max(tol * 2, rtol * abs(2 * w), 1e-9) or (w and abs(g - w / 2) <= max(tol, rtol * abs(w), 1e-9)):
        diag.append(("stat_sided", {}))
    if w and abs(g + w) <= max(tol, rtol * abs(w), 1e-9):
        diag.append(("stat_sign", {}))
    if w and abs(g * 100 - w) <= max(tol, rtol * abs(w), 1e-9) or (w and abs(g - w * 100) <= max(tol * 100, rtol * abs(w * 100), 1e-9)):
        diag.append(("stat_percent", {}))
    rel = abs(g - w) / abs(w) if w else None
    diag.append(("stat_value", {"var": var, "tol": spec.get("tol") or ("%g%%" % (rtol * 100)), "off": ("в %.0f%% от ожидаемого" % (rel * 100)) if rel is not None and rel < 10 else "сильно"}))
    return False, diag


def _outputs(task):
    if task.get("outputs"):
        return task["outputs"]
    if task["type"] == "plot" or "plot" in task:
        return [{"var": FIG_VAR}]
    return [{"var": "result"}]


def _get_out(ns, var):
    if var == FIG_VAR:
        return True, _current_figure(ns)
    return (var in ns), ns.get(var)


def _check_value(task, code, tree, code_obj):
    variants = task["variants"]
    budget = _fresh_budget()
    max_ms = task.get("max_ms")
    for vi, variant in enumerate(variants):
        stage = "visible" if vi == 0 else "hidden"
        _close_figs()
        with _Dir(_task_dir(task, variant)):
            ns, stream, out = _prepare_ns(task, variant)
            run = execute(code_obj, "", budget, ns=ns, stream=stream, out=out)
        if run.error or run.limit:
            _close_figs()
            return _result(False, stage, error=run.error, limit=run.limit, stdout=run.stdout if vi == 0 else "",
                           hidden={"total": len(variants) - 1, "failed": vi} if vi else None,
                           detectors=detect(tree, code, {"error": run.error, "limit": run.limit, "task": task, "warnings": run.warnings}))
        if max_ms and run.ms > max_ms * (3 if vi else 1):
            return _result(False, stage, stdout=run.stdout if vi == 0 else "", detectors=detect(tree, code, {"limit": "slow", "ms": round(run.ms), "max_ms": max_ms, "task": task}))
        for oi, o in enumerate(_outputs(task)):
            var = o["var"]
            exp = o["expected"][vi]
            present, got = _get_out(ns, var)
            if not present:
                return _result(False, stage, stdout=run.stdout if vi == 0 else "", step=oi if len(_outputs(task)) > 1 else None,
                               detectors=detect(tree, code, {"diag": [("result_missing", {"var": var})], "task": task, "warnings": run.warnings}))
            kind = o["spec"]["kind"]
            if kind == "plot":
                try:
                    summ = plot_summary(got) if got is not None else None
                except Exception as e:
                    summ = None
                ok, diag = _compare_plot(summ, o["spec"], exp)
            elif kind == "num":
                ok, diag = _compare_num(got, o["spec"], exp, task.get("id", ""), var)
            else:
                ok, diag = _compare(got, o["spec"], exp)
            if not ok:
                extra = {}
                if vi == 0:
                    if kind == "plot":
                        extra["got_preview"] = {"kind": "image", "src": _fig_png(got)} if got is not None else None
                    elif kind == "num":
                        extra["got_preview"] = preview(got)
                    else:
                        extra["got_preview"] = preview(got)
                    extra["expected_preview"] = o.get("preview") if kind != "num" else None
                    extra["var"] = var if var != FIG_VAR else "график"
                if kind == "value" and exp.get("type") == "bool" and isinstance(got, bool) and (task["type"] == "stat" or task.get("type_hint") == "stat"):
                    diag = [("stat_decision", {"var": var})] + diag
                _close_figs()
                if any(d[0] == "array_shape" for d in diag) and "axis" in code:
                    diag = [("axis_confusion", next(d[1] for d in diag if d[0] == "array_shape"))] + diag
                ctx = {"diag": diag, "task": task, "warnings": run.warnings, "wrong": {"got": None, "expected": None}}
                if any(d[0] == "shape_rows" for d in diag) and re.search(r"\.merge\(|pd\.merge\(", code):
                    g = next(d[1] for d in diag if d[0] == "shape_rows")
                    if g["got"] < g["expected"] and "how=" not in code:
                        ctx["diag"] = diag + [("merge_inner", {})]
                    elif g["got"] > g["expected"]:
                        ctx["diag"] = diag + [("merge_dupes", {})]
                return _result(False, stage, stdout=run.stdout if vi == 0 else "", step=oi if len(_outputs(task)) > 1 else None,
                               hidden={"total": len(variants) - 1, "failed": vi} if vi else None,
                               detectors=detect(tree, code, ctx), **extra)
        _close_figs()
    star3 = all(check_rule(r, tree, code) for r in (task.get("star3") or []) if r != "first_try")
    return _result(True, "done", hidden={"total": len(variants) - 1, "failed": None}, star3=star3, visible_count=1)


def _function_steps(task):
    if task.get("steps"):
        return [s["function"] for s in task["steps"]]
    return [task["function"]]


# ---------- функции с допуском ----------

def _func_tol(task):
    t = task.get("tol")
    return None if t is None else float(t)


def _func_expect(task, call, value):
    k, c = _obf_key(task.get("id", ""), "call:" + call)
    vals = _num_list(value)
    return {"n": len(vals), "enc": [x * k + c for x in vals], "type": type_name(value)} if vals is not None else None


def _func_close(task, call, value, exp):
    if exp is None:
        return False
    vals = _num_list(value)
    if vals is None or len(vals) != exp["n"]:
        return False
    k, c = _obf_key(task.get("id", ""), "call:" + call)
    tol = _func_tol(task)
    for g, e in zip(vals, exp["enc"]):
        w = (float(e) - c) / k
        if math.isnan(w) or math.isinf(w):
            if not (g == w or (math.isnan(g) and math.isnan(w))):
                return False
            continue
        if math.isnan(g) or abs(g - w) > tol + 1e-7 * abs(w):
            return False
    return True


# ---------- модели ----------

MODEL_METRICS = {
    "roc_auc": ("ROC-AUC", True), "f1": ("F1", True), "accuracy": ("accuracy", True), "precision": ("precision", True),
    "recall": ("recall", True), "r2": ("R²", True), "mae": ("MAE", False), "rmse": ("RMSE", False), "mape": ("MAPE", False),
}


def _rank_avg(a):
    import numpy as np
    order = np.argsort(a, kind="mergesort")
    ranks = np.empty(len(a), dtype=float)
    sa = a[order]
    i = 0
    while i < len(a):
        j = i
        while j + 1 < len(a) and sa[j + 1] == sa[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return ranks


def _metric(name, y_true, pred):
    import numpy as np
    y = np.asarray(y_true, dtype=float).ravel()
    p = np.asarray(pred, dtype=float).ravel()
    if len(y) != len(p):
        raise ValueError("Длина прогноза %d не совпадает с числом объектов %d" % (len(p), len(y)))
    if name == "roc_auc":
        pos = y == 1
        n1, n0 = pos.sum(), (~pos).sum()
        r = _rank_avg(p)
        return float((r[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))
    if name in ("f1", "precision", "recall", "accuracy"):
        tp = float(((p == 1) & (y == 1)).sum())
        fp = float(((p == 1) & (y != 1)).sum())
        fn = float(((p != 1) & (y == 1)).sum())
        if name == "accuracy":
            return float((p == y).mean())
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        if name == "precision":
            return prec
        if name == "recall":
            return rec
        return 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    if name == "r2":
        return float(1 - ((y - p) ** 2).sum() / ((y - y.mean()) ** 2).sum())
    if name == "mae":
        return float(np.abs(y - p).mean())
    if name == "rmse":
        return float(np.sqrt(((y - p) ** 2).mean()))
    if name == "mape":
        return float((np.abs(y - p) / np.maximum(np.abs(y), np.finfo(float).eps)).mean())
    raise ValueError(name)


def _passes(name, value, threshold):
    return value >= threshold if MODEL_METRICS[name][1] else value <= threshold


def _model_predict(model, X, spec):
    import numpy as np
    if spec.get("proba", spec.get("metric") == "roc_auc"):
        p = model.predict_proba(X)
        p = np.asarray(p)
        return p[:, 1] if p.ndim == 2 else p
    return np.asarray(model.predict(X)).ravel()


def _test_set(task, variant_dir):
    spec = task["model"]
    ns = {}
    code = spec.get("test_setup") or ""
    if not code:
        drop = [spec["target"]] + list(spec.get("drop") or [])
        code = ("import pandas as pd\n_df = pd.read_csv(%r)\nX_test = _df.drop(columns=%r)\ny_test = _df[%r]\n" % (spec["data"] + ".csv", drop, spec["target"]))
    with _Dir(variant_dir):
        old = sys.stdout
        sys.stdout = io.StringIO()
        try:
            exec(compile(code, SETUP_FILE, "exec"), ns)
        finally:
            sys.stdout = old
    return ns["X_test"], ns["y_test"]


def _seed_all():
    random.seed(0)
    np = sys.modules.get("numpy")
    if np is not None:
        np.random.seed(0)


def _leak_before_split(tree):
    split_line = None
    for n in ast.walk(tree):
        if isinstance(n, ast.Call):
            f = n.func
            name = f.attr if isinstance(f, ast.Attribute) else (f.id if isinstance(f, ast.Name) else None)
            if name == "train_test_split":
                split_line = n.lineno if split_line is None else min(split_line, n.lineno)
    if split_line is None:
        return None
    for n in ast.walk(tree):
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in ("fit", "fit_transform") and n.lineno < split_line:
            return n.lineno
    return None


def _run_model_code(task, code_obj, shuffle=False):
    variant = {"data": "public", "seed": _seed_of(task["id"], 1)}
    with _Dir(_task_dir(task, variant)):
        _seed_all()
        ns, stream, out = _prepare_ns(task, variant, shuffle=shuffle)
        budget = _Budget(STEP_LIMIT * 20)
        run = execute(code_obj, "", budget, ns=ns, stream=stream, out=out)
    return run, ns


def _evaluate_model(task, ns, variant="hidden"):
    spec = task["model"]
    var = spec.get("var", "model")
    model = ns.get(var)
    if model is None:
        return None, [("result_missing", {"var": var})], None
    if not (hasattr(model, "predict") or hasattr(model, "predict_proba")):
        return None, [("model_object", {"var": var, "got": type(model).__name__})], None
    X_test, y_test = _test_set(task, "/data/" + variant if task.get("data") else WORK_DIR)
    try:
        pred = _model_predict(model, X_test, spec)
        value = _metric(spec["metric"], y_test, pred)
    except Exception as e:
        info = _error_info(e)
        return None, None, info
    return value, None, None


def _check_model(task, code, tree, code_obj):
    spec = task["model"]
    name, higher = MODEL_METRICS[spec["metric"]]
    leak_line = _leak_before_split(tree)
    if leak_line is not None:
        return _result(False, "static", detectors=[{"id": "leak_fit_before_split", "line": leak_line, "params": {}}])
    run, ns = _run_model_code(task, code_obj)
    if run.error or run.limit:
        return _result(False, "visible", error=run.error, limit=run.limit, stdout=run.stdout,
                       detectors=detect(tree, code, {"error": run.error, "limit": run.limit, "task": task, "warnings": run.warnings}))
    value, diag, err = _evaluate_model(task, ns)
    if diag:
        return _result(False, "visible", stdout=run.stdout, detectors=detect(tree, code, {"diag": diag, "task": task}))
    if err:
        return _result(False, "hidden", stdout=run.stdout, error=err, hidden={"total": 1, "failed": 1},
                       detectors=detect(tree, code, {"error": err, "task": task, "model_predict": True}))
    shown = {"name": name, "value": round(value, 4), "threshold": spec["threshold"], "higher": higher}
    if not _passes(spec["metric"], value, spec["threshold"]):
        diag = [("model_metric", {"metric": name, "got": round(value, 4), "threshold": spec["threshold"], "cmp": "не ниже" if higher else "не выше"})]
        try:
            tv, _, terr = _evaluate_model(task, ns, "public")
            if tv is not None and terr is None and (tv - value if higher else value - tv) > float(spec.get("gap", 0.1)) * (1 if higher else max(abs(value), 1e-9)):
                diag.append(("model_overfit", {"metric": name, "train": round(tv, 4), "test": round(value, 4)}))
        except Exception:
            pass
        return _result(False, "hidden", stdout=run.stdout, hidden={"total": 1, "failed": 1}, model_metric=shown, detectors=detect(tree, code, {"diag": diag, "task": task}))
    if spec.get("leak_check"):
        run2, ns2 = _run_model_code(task, code_obj, shuffle=True)
        if run2.error is None and run2.limit is None:
            v2, d2, e2 = _evaluate_model(task, ns2)
            if v2 is not None and _passes(spec["metric"], v2, spec["threshold"]):
                return _result(False, "hidden", stdout=run.stdout, hidden={"total": 1, "failed": 1}, model_metric=shown,
                               detectors=detect(tree, code, {"diag": [("leak_target", {})], "task": task}))
    star3 = all(check_rule(r, tree, code) for r in (task.get("star3") or []) if r != "first_try")
    return _result(True, "done", stdout=run.stdout, hidden={"total": 1, "failed": None}, star3=star3, model_metric=shown)


def _prepare_model(task, out):
    spec = task.get("model") or {}
    for k in ("metric", "threshold"):
        if k not in spec:
            return None, ["model: нет поля " + k]
    if spec["metric"] not in MODEL_METRICS:
        return None, ["model: неизвестная метрика " + spec["metric"]]
    if not spec.get("test_setup") and not (spec.get("data") and spec.get("target")):
        return None, ["model: нужны data и target или test_setup"]
    errors = []
    ref = task.get("reference", "")
    tree, syn = parse(ref)
    if syn:
        return None, ["эталон не компилируется: " + syn["msg"]]
    run, ns = _run_model_code(task, _compile(ref))
    if run.error or run.limit:
        return None, ["эталон падает: %s" % (run.error or run.limit)]
    value, diag, err = _evaluate_model(task, ns)
    if err or diag:
        return None, ["эталон не даёт прогноз на скрытых данных: %s" % (err or diag)]
    if not _passes(spec["metric"], value, spec["threshold"]):
        errors.append("эталон не проходит порог: %s = %.4f, порог %s" % (spec["metric"], value, spec["threshold"]))
    out["reference_metric"] = round(value, 4)
    base = spec.get("baseline")
    if base:
        bns = dict(ns)
        exec(compile(base, "<baseline>", "exec"), bns)
        bv, bd, be = _evaluate_model(task, bns)
        if bv is not None and _passes(spec["metric"], bv, spec["threshold"]):
            errors.append("простая модель-бейзлайн проходит порог: %.4f" % bv)
        out["baseline_metric"] = None if bv is None else round(bv, 4)
    out["tests"] = {"visible": [], "hidden": []}
    out["data_dir"] = "public"
    return out, errors


def check(task, code):
    kind = _kind(task)
    if kind == "predict":
        got = normalize_output(code)
        ok = hash_output(got) == task["answer_hash"]
        detectors = []
        if not ok and got.strip() == "":
            detectors.append({"id": "predict_empty", "line": None, "params": {}})
        elif not ok:
            exp_hint = task.get("answer_lines")
            if exp_hint is not None and len(got.split("\n")) != exp_hint:
                detectors.append({"id": "predict_lines", "line": None, "params": {"n": exp_hint}})
        return _result(ok, "done" if ok else "visible", detectors=detectors, star3=ok)

    if task["type"] == "fill_gaps":
        good, why = _fill_gaps_ok(task["template"], code)
        if not good:
            return _result(False, "static", detectors=[{"id": "fill_structure" if why == "structure" else "fill_gap", "line": None, "params": {}}])

    tree, syn = parse(code)
    if syn:
        return _result(False, "syntax", error=syn, detectors=detect(None, code, {"error": syn, "task": task}))

    bad = static_violations(tree)
    if bad:
        return _result(False, "static", detectors=bad)

    for rule in task.get("requires") or []:
        if not check_rule(rule, tree, code):
            return _result(False, "requires", rule=rule, detectors=detect(tree, code, {"task": task}))

    code_obj = _compile(code)
    if kind == "value":
        return _check_value(task, code, tree, code_obj)
    if kind == "model":
        return _check_model(task, code, tree, code_obj)

    budget = _fresh_budget()
    tests = []
    if kind == "stdio":
        with _Dir(_task_dir(task, None)):
            for i, t in enumerate(task["tests"]["visible"]):
                run = execute(code_obj, t["in"], budget)
                got = normalize_output(run.stdout)
                passed = run.error is None and run.limit is None and got == t["out"]
                tests.append({"n": i + 1, "input": t["in"], "expected": t["out"], "got": got, "pass": passed, "error": run.error, "limit": run.limit})
                if not passed:
                    ctx = {"error": run.error, "limit": run.limit, "task": task, "warnings": run.warnings}
                    if run.error is None and run.limit is None:
                        ctx["wrong"] = {"got": got, "expected": t["out"]}
                    return _result(False, "visible", tests=tests, error=run.error, limit=run.limit, detectors=detect(tree, code, ctx))
            for i, t in enumerate(task["tests"]["hidden"]):
                run = execute(code_obj, t["in"], budget)
                passed = run.error is None and run.limit is None and hash_output(run.stdout) == t["h"]
                if not passed:
                    ctx = {"error": run.error, "limit": run.limit, "task": task, "warnings": run.warnings}
                    if run.error is None and run.limit is None:
                        ctx["wrong"] = {"got": normalize_output(run.stdout), "expected": None}
                    return _result(False, "hidden", tests=tests, hidden={"total": len(task["tests"]["hidden"]), "failed": i + 1, "input": t["in"] if t.get("show") else None},
                                   error=run.error, limit=run.limit, detectors=detect(tree, code, ctx))
    else:
        with _Dir(_task_dir(task, None)):
            ns, stream, out = _prepare_ns(task, None)
            base = execute(code_obj, "", budget, ns=ns, stream=stream, out=out)
            if base.error or base.limit:
                return _result(False, "visible", error=base.error, limit=base.limit, stdout=base.stdout, detectors=detect(tree, code, {"error": base.error, "limit": base.limit, "task": task}))
            for si, fname in enumerate(_function_steps(task)):
                if not callable(ns.get(fname)):
                    return _result(False, "visible", step=si if task.get("steps") else None, detectors=detect(tree, code, {"missing_function": fname, "task": task}))
            for i, t in enumerate(task["tests"]["visible"]):
                run = call_in(ns, t["call"], budget)
                passed = run.error is None and run.limit is None and (_func_close(task, t["call"], run.value, t.get("num")) if _func_tol(task) is not None else repr(canon(run.value)) == t["canon"])
                tests.append({"n": i + 1, "input": t["call"], "expected": t["out"], "got": short_repr(run.value) if run.error is None and run.limit is None else None,
                              "pass": passed, "error": run.error, "limit": run.limit, "stdout": run.stdout, "step": t.get("step")})
                if not passed:
                    fname = _function_steps(task)[t.get("step") or 0]
                    ctx = {"error": run.error, "limit": run.limit, "task": task, "function_name": fname}
                    if run.error is None and run.limit is None:
                        ctx["returned_none"] = run.value is None and t["out"] != "None"
                        ctx["wrong"] = {"got": None, "expected": None}
                        if t.get("type") and type_name(run.value) != t["type"] and run.value is not None:
                            ctx["wrong"]["type_mismatch"] = (type_name(run.value), t["type"])
                    return _result(False, "visible", tests=tests, error=run.error, limit=run.limit, step=t.get("step"), detectors=detect(tree, code, ctx))
            for i, t in enumerate(task["tests"]["hidden"]):
                run = call_in(ns, t["call"], budget)
                passed = run.error is None and run.limit is None and (_func_close(task, t["call"], run.value, t.get("num")) if _func_tol(task) is not None else hash_value(run.value) == t["h"])
                if not passed:
                    fname = _function_steps(task)[t.get("step") or 0]
                    ctx = {"error": run.error, "limit": run.limit, "task": task, "function_name": fname}
                    if run.error is None and run.limit is None:
                        ctx["returned_none"] = run.value is None
                        ctx["wrong"] = {"got": None, "expected": None}
                    return _result(False, "hidden", tests=tests, step=t.get("step"), hidden={"total": len(task["tests"]["hidden"]), "failed": i + 1, "input": t["call"] if t.get("show") else None},
                                   error=run.error, limit=run.limit, detectors=detect(tree, code, ctx))

    star3 = all(check_rule(r, tree, code) for r in (task.get("star3") or []) if r != "first_try")
    return _result(True, "done", tests=tests, hidden={"total": len(task["tests"]["hidden"]), "failed": None}, star3=star3)


def _split_last_expr(tree):
    body = tree.body
    if body and isinstance(body[-1], ast.Expr):
        v = body[-1].value
        if not (isinstance(v, ast.Call) and isinstance(v.func, ast.Name) and v.func.id == "print"):
            return ast.Module(body=body[:-1], type_ignores=[]), ast.Expression(body=v)
    return tree, None


def run_free(code, stdin_text="", function=None, calls=None, task=None, display=True):
    tree, syn = parse(code)
    if syn:
        return {"stdout": "", "error": syn, "detectors": detect(None, code, {"error": syn}), "calls": []}
    bad = static_violations(tree)
    if bad:
        return {"stdout": "", "error": None, "detectors": bad, "calls": []}
    task = task or {}
    kind = _kind(task) if task.get("type") else None
    variant = (task.get("variants") or [None])[0] if kind == "value" else ({"data": task.get("data_dir")} if task.get("data_dir") else None)
    body, last = _split_last_expr(tree) if display and not function else (tree, None)
    budget = _fresh_budget()
    _close_figs()
    with _Dir(_task_dir(task, variant)):
        ns, stream, out = _prepare_ns(task, variant, stdin_text=stdin_text)
        run = execute(compile(body, PLAYER_FILE, "exec"), stdin_text, budget, ns=ns, stream=stream, out=out)
        res = {"stdout": run.stdout, "error": run.error, "limit": run.limit, "calls": [], "detectors": [], "outputs": [], "ms": round(run.ms)}
        if run.error or run.limit:
            res["detectors"] = detect(tree, code, {"error": run.error, "limit": run.limit, "warnings": run.warnings})
            return res
        if last is not None:
            r = call_in(ns, ast.unparse(last.body), budget)
            res["stdout"] += r.stdout
            if r.error or r.limit:
                res["error"], res["limit"] = r.error, r.limit
                res["detectors"] = detect(tree, code, {"error": r.error, "limit": r.limit})
                return res
            if r.value is not None:
                res["display"] = preview(r.value)
        if run.warnings:
            res["detectors"] = detect(tree, code, {"warnings": run.warnings})
        if kind == "value":
            for o in _outputs(task):
                if o["var"] == FIG_VAR:
                    continue
                if o["var"] in ns:
                    res["outputs"].append({"var": o["var"], "preview": preview(ns[o["var"]])})
                else:
                    res["outputs"].append({"var": o["var"], "missing": True})
        plt = _plt()
        if plt is not None and plt.get_fignums():
            try:
                res["figures"] = [_fig_png(plt.figure(n)) for n in plt.get_fignums()[:4]]
            except Exception as e:
                res["figures"] = []
            _close_figs()
        if function and calls:
            if not callable(ns.get(function)):
                res["detectors"] = detect(tree, code, {"missing_function": function})
                return res
            for c in calls:
                r = call_in(ns, c, budget)
                res["calls"].append({"call": c, "value": short_repr(r.value) if r.error is None and r.limit is None else None, "stdout": r.stdout, "error": r.error, "limit": r.limit})
                if r.error or r.limit:
                    res["detectors"] = detect(tree, code, {"error": r.error, "limit": r.limit})
                    break
    return res


def _gen_inputs(spec, seed):
    rnd = random.Random(seed)
    env = {"random": rnd, "rnd": rnd, "math": math, "string": __import__("string")}
    helpers = spec.get("helpers")
    if helpers:
        exec(helpers, env)
    return [eval(spec["gen"], env) for _ in range(int(spec.get("count", 30)))]


def _seed_of(task_id, k):
    return (sum((i + 1) * ord(c) for i, c in enumerate(task_id)) * 7919 + k * 104729) % 2_000_000_000


def _prepare_value(task, out):
    errors = []
    ref = task.get("reference", "")
    tree, syn = parse(ref)
    if syn:
        return None, ["эталон не компилируется: " + syn["msg"]]
    if task.get("data"):
        variants = [{"data": "public", "seed": _seed_of(task["id"], 1)}, {"data": "hidden", "seed": _seed_of(task["id"], 2)}]
    else:
        n = int(task.get("variants_count", 3))
        variants = [{"data": None, "seed": _seed_of(task["id"], k + 1)} for k in range(n)]
    out["variants"] = variants
    outs = [dict(o) for o in _outputs(task)]
    code_obj = _compile(ref)
    for o in outs:
        o["expected"] = []
    for vi, variant in enumerate(variants):
        _close_figs()
        with _Dir(_task_dir(task, variant)):
            try:
                ns, stream, buf = _prepare_ns(task, variant)
            except Exception as e:
                return None, ["setup падает: %s" % e]
            run = execute(code_obj, "", _fresh_budget(), ns=ns, stream=stream, out=buf)
        if run.error or run.limit:
            return None, ["эталон падает на варианте %d: %s" % (vi, run.error or run.limit)]
        if run.warnings and any(w in ("ChainedAssignmentError", "SettingWithCopyWarning", "FutureWarning", "DeprecationWarning") for w in run.warnings):
            errors.append("эталон вызывает предупреждения: %s" % ", ".join(sorted(set(run.warnings))))
        for o in outs:
            present, v = _get_out(ns, o["var"])
            if not present or (o["var"] == FIG_VAR and v is None):
                return None, ["эталон не создаёт %s" % ("график" if o["var"] == FIG_VAR else "переменную " + o["var"])]
            if vi == 0:
                o["spec"] = _spec_for(v, task, o)
                if o["spec"]["kind"] == "plot":
                    o["preview"] = {"kind": "image", "src": _fig_png(v, dpi=64)}
                elif o["spec"]["kind"] == "num":
                    o["preview"] = None
                else:
                    o["preview"] = preview(v, rows=int(o.get("preview_rows", task.get("preview_rows", 10))))
            if o["spec"]["kind"] == "plot":
                summ = plot_summary(v)
                if not summ["axes"]:
                    errors.append("эталонный график пустой")
                o["expected"].append(summ)
                continue
            if o["spec"]["kind"] == "num":
                if _num_list(v) is None:
                    errors.append("эталон кладёт в %s не число" % o["var"])
                    return None, errors
                o["expected"].append(_num_signature(v, o["spec"], task.get("id", ""), o["var"]))
                continue
                if o["spec"]["kind"] == "frame" and len(v) == 0:
                    errors.append("эталон даёт пустую таблицу в %s" % o["var"])
                if o["spec"]["kind"] == "array" and getattr(v, "size", 1) == 0:
                    errors.append("эталон даёт пустой массив в %s" % o["var"])
            o["expected"].append(_signature(v, o["spec"]))
    _close_figs()
    same = []
    for o in outs:
        hashes = [e.get("hash") or json.dumps(e, sort_keys=True, default=str) for e in o["expected"]]
        if len(set(hashes)) < 2:
            same.append(o["var"])
        if task.get("hide_expected"):
            o["preview"] = None
    if same and len(same) == len(outs) and not task.get("same_ok"):
        errors.append("результат %s одинаков на всех вариантах данных — подгонка пройдёт" % ", ".join(same))
    out["outputs"] = outs
    out["tests"] = {"visible": [], "hidden": []}
    return out, errors


def _expand_steps(task):
    steps = task.get("steps")
    if not steps:
        return task
    t = dict(task)
    vis, hid, rnd = [], [], []
    for si, s in enumerate(steps):
        for c in (s.get("tests") or {}).get("visible") or []:
            vis.append({"call": c["call"] if isinstance(c, dict) else c, "step": si})
        for c in (s.get("tests") or {}).get("hidden") or []:
            hid.append({"call": c["call"] if isinstance(c, dict) else c, "step": si})
        if s.get("random"):
            for c in _gen_inputs(s["random"], _seed_of(task["id"], 50 + si)):
                hid.append({"call": c, "step": si})
    t["tests"] = {"visible": vis, "hidden": hid}
    t["function"] = steps[0]["function"]
    t.pop("random", None)
    return t


def prepare(task):
    errors = []
    kind = _kind(task)
    task = _expand_steps(task)
    out = {k: task[k] for k in task if k not in ("tests", "reference", "buggy_variants", "random")}
    if task.get("steps"):
        out["steps"] = [{"title": s.get("title", ""), "function": s["function"]} for s in task["steps"]]
    ref = task.get("reference", "")
    if kind == "predict":
        tree, syn = parse(task["code"])
        if syn:
            return None, ["predict: код не компилируется"]
        with _Dir(_task_dir(task, {"data": task.get("data_dir")} if task.get("data_dir") else None)):
            ns, stream, buf = _prepare_ns(task, None, stdin_text=task.get("stdin", ""))
            run = execute(_compile(task["code"]), task.get("stdin", ""), _fresh_budget(), ns=ns, stream=stream, out=buf)
        if run.error or run.limit:
            return None, ["predict: код падает " + str(run.error)]
        ans = normalize_output(run.stdout)
        out["answer_hash"] = hash_output(ans)
        out["answer_lines"] = len(ans.split("\n"))
        out["tests"] = {"visible": [], "hidden": []}
        out["_answer"] = ans
        return out, errors

    if kind == "value":
        built, errs = _prepare_value(task, out)
        if built is None:
            return None, errs
        errors += errs
        out = built
    elif kind == "model":
        built, errs = _prepare_model(task, out)
        if built is None:
            return None, errs
        errors += errs
        out = built
    else:
        tree, syn = parse(ref)
        if syn:
            return None, ["эталон не компилируется: " + syn["msg"]]
        code_obj = _compile(ref)
        tests = task.get("tests") or {}
        vis_in = list(tests.get("visible") or [])
        hid_in = list(tests.get("hidden") or [])
        if task.get("random"):
            hid_in += _gen_inputs(task["random"], sum(map(ord, task["id"])) * 7919)
        if not vis_in:
            errors.append("нет видимых тестов")
        built = {"visible": [], "hidden": []}
        seen_out = set()
        if kind == "stdio":
            with _Dir(_task_dir(task, None)):
                for t in vis_in:
                    src = t["in"] if isinstance(t, dict) else t
                    run = execute(code_obj, str(src), _fresh_budget())
                    if run.error or run.limit:
                        errors.append("эталон падает на видимом тесте %r: %s" % (src, run.error or run.limit))
                        continue
                    got = normalize_output(run.stdout)
                    if isinstance(t, dict) and "out" in t and normalize_output(str(t["out"])) != got:
                        errors.append("видимый тест %r: в YAML %r, эталон даёт %r" % (src, t["out"], got))
                    if got == "":
                        errors.append("эталон выводит пустую строку на тесте %r" % (src,))
                    built["visible"].append({"in": str(src), "out": got})
                    seen_out.add(got)
                for t in hid_in:
                    src = t["in"] if isinstance(t, dict) else t
                    run = execute(code_obj, str(src), _fresh_budget())
                    if run.error or run.limit:
                        errors.append("эталон падает на скрытом тесте %r: %s" % (src, run.error or run.limit))
                        continue
                    built["hidden"].append({"in": str(src), "h": hash_output(run.stdout)})
                    seen_out.add(normalize_output(run.stdout))
        else:
            with _Dir(_task_dir(task, None)):
                ns, stream, buf = _prepare_ns(task, None)
                base = execute(code_obj, "", _fresh_budget(), ns=ns, stream=stream, out=buf)
                if base.error:
                    return None, ["эталон падает при определении функции: " + str(base.error)]
                for fname in _function_steps(task):
                    if not callable(ns.get(fname)):
                        return None, ["в эталоне нет функции " + fname]
                for t in vis_in:
                    call = t["call"] if isinstance(t, dict) else t
                    r = call_in(ns, call, _fresh_budget())
                    if r.error or r.limit:
                        errors.append("эталон падает на %s: %s" % (call, r.error or r.limit))
                        continue
                    item = {"call": call, "out": short_repr(r.value, 2000), "canon": repr(canon(r.value)), "type": type_name(r.value)}
                    if _func_tol(task) is not None:
                        item["num"] = _func_expect(task, call, r.value)
                        if item["num"] is None:
                            errors.append("при tol функция должна возвращать числа: %s" % call)
                    if isinstance(t, dict) and "step" in t:
                        item["step"] = t["step"]
                    built["visible"].append(item)
                    seen_out.add(repr(canon(r.value)))
                for t in hid_in:
                    call = t["call"] if isinstance(t, dict) else t
                    r = call_in(ns, call, _fresh_budget())
                    if r.error or r.limit:
                        errors.append("эталон падает на скрытом %s: %s" % (call, r.error or r.limit))
                        continue
                    item = {"call": call, "h": hash_value(r.value)}
                    if _func_tol(task) is not None:
                        item["num"] = _func_expect(task, call, r.value)
                    if isinstance(t, dict) and "step" in t:
                        item["step"] = t["step"]
                    built["hidden"].append(item)
                    seen_out.add(repr(canon(r.value)))
        if len(hid_in) < 3:
            errors.append("меньше 3 скрытых тестов")
        if len(seen_out) < 2 and len(vis_in) + len(hid_in) > 1:
            errors.append("все тесты дают одинаковый ответ — подгонка пройдёт")
        out["tests"] = built
    tree, _ = parse(ref)
    for rule in task.get("requires") or []:
        try:
            if not check_rule(rule, tree, ref):
                errors.append("эталон нарушает требование " + rule)
        except ValueError as e:
            errors.append(str(e))
    for rule in task.get("star3") or []:
        try:
            check_rule(rule, tree, ref)
        except ValueError as e:
            errors.append(str(e))
    if errors:
        return None, errors
    full = check(out, ref)
    if not full["ok"]:
        return None, ["эталон не проходит собственную проверку: " + json.dumps(full, ensure_ascii=False, default=str)[:600]]
    if task["type"] == "fix_bug":
        sr = check(out, task["starter"])
        if sr["ok"]:
            errors.append("код с багом (starter) проходит проверку")
    if task["type"] == "fill_gaps":
        good, _ = _fill_gaps_ok(task["template"], ref)
        if not good:
            errors.append("эталон не совпадает с шаблоном fill_gaps")
        tr = check(out, task["template"])
        if tr["ok"]:
            errors.append("шаблон с пропусками проходит проверку")
    for bv in task.get("buggy_variants") or []:
        r = check(out, bv["code"])
        if r["ok"]:
            errors.append("вариант с багом проходит проверку: " + bv["code"][:80])
        elif bv.get("expect_detector"):
            ids = [d["id"] for d in r["detectors"]]
            if bv["expect_detector"] not in ids:
                errors.append("вариант с багом не вызвал детектор %s (сработали: %s)" % (bv["expect_detector"], ids))
    if errors:
        return None, errors
    return out, []


def _json_safe(o):
    if isinstance(o, float):
        if math.isnan(o):
            return "nan"
        if math.isinf(o):
            return "inf" if o > 0 else "-inf"
        return o
    if isinstance(o, dict):
        return {k: _json_safe(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_json_safe(v) for v in o]
    return o


def api(name, payload_json):
    payload = json.loads(payload_json)
    if name == "check":
        res = check(payload["task"], payload["code"])
    elif name == "run":
        res = run_free(payload["code"], payload.get("stdin", ""), payload.get("function"), payload.get("calls"), payload.get("task"), payload.get("display", True))
    elif name == "prepare":
        built, errs = prepare(payload["task"])
        res = {"task": built, "errors": errs}
    else:
        res = {"error": "unknown api"}
    try:
        return json.dumps(res, ensure_ascii=False, default=str, allow_nan=False)
    except ValueError:
        return json.dumps(_json_safe(json.loads(json.dumps(res, ensure_ascii=False, default=str))), ensure_ascii=False)
