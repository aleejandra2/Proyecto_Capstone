from typing import Dict, Any, List, Set

def grade(activity_type: str, config: Dict[str, Any], respuestas: Dict[str, Any]) -> tuple[float, Dict[str, Any]]:
    """
    Devuelve (score_normalizado_0a1, feedback_dict)
    """
    if activity_type == "MCQ":
        return _grade_mcq(config, respuestas)
    if activity_type == "TF":
        return _grade_tf(config, respuestas)
    if activity_type == "FIB":
        return _grade_fib(config, respuestas)
    if activity_type == "SORT":
        return _grade_sort(config, respuestas)
    if activity_type == "MATCH":
        return _grade_match(config, respuestas)
    return 0.0, {"error": "Tipo no soportado"}

def _grade_mcq(config: Dict[str, Any], resp: Dict[str, Any]):
    preguntas = config.get("preguntas", [])
    total = len(preguntas) or 1
    aciertos = 0
    detalle = []
    for q in preguntas:
        qid = q["id"]
        correctas: Set[int] = set(q.get("correctas", []))
        resp_idx = set(resp.get(qid, [] if q.get("multiple") else ([-1] if resp.get(qid) is None else [resp.get(qid)])))
        ok = resp_idx == correctas
        aciertos += 1 if ok else 0
        detalle.append({"id": qid, "correcta": ok, "respuesta": list(resp_idx), "esperada": list(correctas)})
    return aciertos/total, {"detalle": detalle}

def _grade_tf(config, resp):
    items = config.get("items", [])
    total = len(items) or 1
    aciertos = 0
    det = []
    for it in items:
        iid = it["id"]
        esperado = bool(it.get("correcta"))
        r = bool(resp.get(iid))
        ok = (r == esperado)
        if ok: aciertos += 1
        det.append({"id": iid, "correcta": ok, "respuesta": r, "esperada": esperado})
    return aciertos/total, {"detalle": det}

def _grade_fib(config, resp):
    items = config.get("items", [])
    total = len(items) or 1
    aciertos = 0
    det = []
    def norm(s): return str(s).strip().lower()
    for it in items:
        iid = it["id"]
        esperadas = set(norm(x) for x in it.get("respuestas", []))
        rtxt = norm(resp.get(iid, ""))
        ok = rtxt in esperadas
        if ok: aciertos += 1
        det.append({"id": iid, "correcta": ok, "respuesta": rtxt, "esperada": list(esperadas)})
    return aciertos/total, {"detalle": det}

def _grade_sort(config, resp):
    correcto = config.get("orden_correcto", [])
    r = resp.get("orden", [])
    ok = list(correcto) == list(r)
    return (1.0 if ok else 0.0), {"correcta": correcto, "respuesta": r}

def _grade_match(config, resp):
    # respuestas: lista de pares {"left":"l1","right":"rA"}
    esperado = {(p["left"]["id"], p["right"]["id"]) for p in config.get("pares", [])}
    rset = {(p.get("left"), p.get("right")) for p in resp.get("pares", [])}
    ok = rset == esperado
    # Puntaje parcial: proporción de pares correctos
    inter = len(esperado & rset)
    total = len(esperado) or 1
    return inter/total, {"correctos": inter, "total": total, "det": {"esperado": list(esperado), "respuesta": list(rset)}}
