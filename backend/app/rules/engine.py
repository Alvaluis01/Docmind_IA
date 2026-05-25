from typing import List, Dict, Any
from app.models.hecho import Hecho
from app.models.rules import Regla

def aplicar_reglas(hechos: List[Hecho], reglas: List[Regla]) -> List[Dict[str, Any]]:
    # Agrupar hechos por entidad
    agrupados = {}
    for h in hechos:
        ent = h.entidad_nombre
        if ent not in agrupados:
            agrupados[ent] = {}
        agrupados[ent][h.atributo] = h.valor

    print("\n🔍 Hechos agrupados:")
    for ent, attrs in agrupados.items():
        print(f"  {ent}: {attrs}")

    print(f"\n📋 Reglas a evaluar ({len(reglas)}):")
    for r in reglas:
        print(f"  - {r.nombre} → {r.condiciones_json.get('condiciones')} → +{r.condiciones_json.get('puntaje',0)} pts")

    resultados = []
    for entidad, atributos in agrupados.items():
        puntaje = 0
        justificaciones = []
        for regla in reglas:
            condiciones = regla.condiciones_json.get("condiciones", [])
            puntaje_regla = regla.condiciones_json.get("puntaje", 0)
            cumple = True
            for cond in condiciones:
                attr = cond.get("atributo")
                op = cond.get("operador")
                val_esp = cond.get("valor")
                val_real = atributos.get(attr)
                if val_real is None:
                    cumple = False
                    break
                # Comparación numérica si es posible
                try:
                    v_real = float(val_real)
                    v_esp = float(val_esp)
                    if op == ">" and not (v_real > v_esp):
                        cumple = False
                    elif op == "<" and not (v_real < v_esp):
                        cumple = False
                    elif op == "==" and not (v_real == v_esp):
                        cumple = False
                except (ValueError, TypeError):
                    # Comparación textual
                    if op == "contains":
                        if val_esp.lower() not in val_real.lower():
                            cumple = False
                    elif op == "==":
                        if val_esp.lower() != val_real.lower():
                            cumple = False
            if cumple:
                puntaje += puntaje_regla
                justificaciones.append(f"Cumple '{regla.nombre}': +{puntaje_regla} pts")
                print(f"✅ {entidad} cumple {regla.nombre}")
        if puntaje > 0:
            resultados.append({
                "entidad": entidad,
                "puntaje": puntaje,
                "justificacion": justificaciones
            })
    resultados.sort(key=lambda x: x["puntaje"], reverse=True)
    return resultados