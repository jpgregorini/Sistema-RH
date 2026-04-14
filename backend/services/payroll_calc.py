from database import get_supabase


# INSS 2024 progressive brackets
INSS_BRACKETS = [
    (1621.00, 0.075),
    (2902.84, 0.09),
    (4354.27, 0.12),
    (8475.55, 0.14),
]


def calculate_inss(gross: float) -> float:
    """Calculate INSS using progressive brackets."""
    if gross <= 0:
        return 0.0
    total = 0.0
    prev = 0.0
    for ceiling, rate in INSS_BRACKETS:
        if gross <= prev:
            break
        taxable = min(gross, ceiling) - prev
        total += taxable * rate
        prev = ceiling
    return round(total, 2)


def calculate_payroll(person_type: str, person_id: str, month: str) -> dict:
    db = get_supabase()

    if person_type == "driver":
        return _calculate_driver_payroll(db, person_id, month)
    else:
        return _calculate_employee_payroll(db, person_id, month)


def _get_person_full(db, person_type: str, person_id: str) -> dict:
    """Get person with benefit values and pix_key."""
    table = "drivers" if person_type == "driver" else "employees"
    result = (
        db.table(table)
        .select("name, cpf, pix_key, beneficio_alimentacao, beneficio_transporte, beneficio_refeicao")
        .eq("id", person_id)
        .single()
        .execute()
    )
    return result.data


def _get_advances_breakdown(db, person_type: str, person_id: str, month: str) -> dict:
    """Get all advances for a person in a month, grouped by type."""
    advances_result = (
        db.table("salary_advances")
        .select("*")
        .eq("person_type", person_type)
        .eq("person_id", person_id)
        .eq("payroll_month", month)
        .execute()
    )

    by_type = {"beneficio": [], "salario": [], "produtos": []}
    totals = {"beneficio": 0, "salario": 0, "produtos": 0}
    # Track benefit deductions by category
    benefit_deductions = {"alimentacao": 0, "transporte": 0, "refeicao": 0}

    for a in advances_result.data:
        adv_type = a.get("advance_type", "salario")
        entry = {
            "amount": float(a["amount"]),
            "date": a["advance_date"],
        }
        if adv_type == "beneficio":
            entry["category"] = a.get("beneficio_category")
            cat = a.get("beneficio_category")
            if cat in benefit_deductions:
                benefit_deductions[cat] += float(a["amount"])
        elif adv_type == "produtos":
            entry["product_name"] = a.get("product_name")

        by_type.setdefault(adv_type, []).append(entry)
        totals[adv_type] = totals.get(adv_type, 0) + float(a["amount"])

    total_advances = sum(totals.values())
    # Only salary and product advances are deducted from pay.
    # Benefit advances are deducted from the benefit card, not from salary.
    total_from_pay = totals["salario"] + totals["produtos"]

    return {
        "advances_by_type": by_type,
        "totals_by_type": totals,
        "benefit_deductions": {k: round(v, 2) for k, v in benefit_deductions.items()},
        "total_advances": round(total_advances, 2),
        "total_deducted_from_pay": round(total_from_pay, 2),
    }


def _build_benefit_breakdown(person: dict, benefit_deductions: dict) -> dict:
    """Build the benefit sheet data."""
    alim = float(person.get("beneficio_alimentacao") or 0)
    trans = float(person.get("beneficio_transporte") or 0)
    ref = float(person.get("beneficio_refeicao") or 0)
    gross_benefit = alim + trans + ref

    ded_alim = benefit_deductions.get("alimentacao", 0)
    ded_trans = benefit_deductions.get("transporte", 0)
    ded_ref = benefit_deductions.get("refeicao", 0)
    total_ded = ded_alim + ded_trans + ded_ref

    return {
        "beneficio_bruto": round(gross_benefit, 2),
        "alimentacao_valor": round(alim, 2),
        "alimentacao_deducao": round(ded_alim, 2),
        "transporte_valor": round(trans, 2),
        "transporte_deducao": round(ded_trans, 2),
        "refeicao_valor": round(ref, 2),
        "refeicao_deducao": round(ded_ref, 2),
        "beneficio_liquido": round(gross_benefit - total_ded, 2),
    }


def _calculate_driver_payroll(db, driver_id: str, month: str) -> dict:
    person = _get_person_full(db, "driver", driver_id)

    # Get driver commissions
    comms_result = (
        db.table("driver_company_commissions")
        .select("company, commission_pct")
        .eq("driver_id", driver_id)
        .execute()
    )
    commission_map = {c["company"]: float(c["commission_pct"]) for c in comms_result.data}

    # Get trips for this month
    start = f"{month}-01"
    year, m = month.split("-")
    m = int(m)
    if m == 12:
        end = f"{int(year)+1}-01-01"
    else:
        end = f"{year}-{m+1:02d}-01"

    trips_result = (
        db.table("trips")
        .select("id, trip_date, trip_cargo(*)")
        .eq("driver_id", driver_id)
        .gte("trip_date", start)
        .lt("trip_date", end)
        .execute()
    )

    # Calculate commissions per company
    company_earnings = {}
    trip_details = []
    for trip in trips_result.data:
        trip_info = {"trip_id": trip["id"], "trip_date": trip["trip_date"], "cargo": []}
        for cargo in trip.get("trip_cargo", []):
            company = cargo["company"]
            value = float(cargo["value_brl"])
            pct = commission_map.get(company, 0)
            earning = round(value * pct / 100, 2)

            if company not in company_earnings:
                company_earnings[company] = {"total_value": 0, "total_earning": 0, "pct": pct}
            company_earnings[company]["total_value"] += value
            company_earnings[company]["total_earning"] += earning

            trip_info["cargo"].append({
                "company": company,
                "value_brl": value,
                "commission_pct": pct,
                "earning": earning,
            })
        trip_details.append(trip_info)

    gross_pay = sum(ce["total_earning"] for ce in company_earnings.values())

    # INSS
    inss = calculate_inss(gross_pay)

    # Get advances breakdown
    adv = _get_advances_breakdown(db, "driver", driver_id, month)

    # Net = gross - INSS - salary/product advances
    net_pay = round(gross_pay - inss - adv["total_deducted_from_pay"], 2)

    # Benefit breakdown
    benefit = _build_benefit_breakdown(person, adv["benefit_deductions"])

    return {
        "person_type": "driver",
        "person_id": driver_id,
        "month": month,
        "gross_pay": round(gross_pay, 2),
        "inss": inss,
        "total_deductions": round(inss + adv["total_deducted_from_pay"], 2),
        "total_advances": adv["total_advances"],
        "net_pay": net_pay,
        "breakdown": {
            "company_earnings": company_earnings,
            "trips": trip_details,
            "advances": adv["advances_by_type"],
            "advance_totals": adv["totals_by_type"],
            "benefit": benefit,
            "pix_key": person.get("pix_key"),
        },
    }


def _calculate_employee_payroll(db, employee_id: str, month: str) -> dict:
    person = _get_person_full(db, "employee", employee_id)

    # Get employee base salary
    emp_result = (
        db.table("employees")
        .select("base_salary")
        .eq("id", employee_id)
        .single()
        .execute()
    )
    gross_pay = float(emp_result.data["base_salary"] or 0)

    # INSS
    inss = calculate_inss(gross_pay)

    # Get advances breakdown
    adv = _get_advances_breakdown(db, "employee", employee_id, month)

    # Net = gross - INSS - salary/product advances
    net_pay = round(gross_pay - inss - adv["total_deducted_from_pay"], 2)

    # Benefit breakdown
    benefit = _build_benefit_breakdown(person, adv["benefit_deductions"])

    return {
        "person_type": "employee",
        "person_id": employee_id,
        "month": month,
        "gross_pay": round(gross_pay, 2),
        "inss": inss,
        "total_deductions": round(inss + adv["total_deducted_from_pay"], 2),
        "total_advances": adv["total_advances"],
        "net_pay": net_pay,
        "breakdown": {
            "advances": adv["advances_by_type"],
            "advance_totals": adv["totals_by_type"],
            "benefit": benefit,
            "pix_key": person.get("pix_key"),
        },
    }
