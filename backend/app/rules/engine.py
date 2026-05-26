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
        # Si ya existe el atributo, convertir a lista y agregar
        if h.atributo in agrupados[ent]:
            existing = agrupados[ent][h.atributo]
            if isinstance(existing, list):
                existing.append(h.valor)
            else:
                agrupados[ent][h.atributo] = [existing, h.valor]
        else:
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
                # Si val_real es lista (múltiples hechos), comprobar si ALGUNO cumple
                values = val_real if isinstance(val_real, list) else [val_real]
                matched_any = False
                for vr in values:
                    # Comparación numérica si es posible
                    try:
                        v_real = float(vr)
                        v_esp = float(val_esp)
                        if op == ">" and (v_real > v_esp):
                            matched_any = True
                            break
                        elif op == "<" and (v_real < v_esp):
                            matched_any = True
                            break
                        elif op == "==" and (v_real == v_esp):
                            matched_any = True
                            break
                    except (ValueError, TypeError):
                        # Comparación textual
                        try:
                            vr_low = str(vr).lower()
                            vesp_low = str(val_esp).lower()
                        except Exception:
                            vr_low = str(vr)
                            vesp_low = str(val_esp)
                        if op == "contains":
                            if vesp_low in vr_low:
                                matched_any = True
                                break
                        elif op == "==":
                            if vesp_low == vr_low:
                                matched_any = True
                                break
                if not matched_any:
                    cumple = False
                    break
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