from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase.pdfmetrics import stringWidth
from datetime import date, datetime
import io
import os


LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-novalog.png")

# Contracting company for the Registro de Empregado (NOT Novalog).
EMPLOYER = {
    "name": "JPX DO BRASIL SERVICOS LTDA",
    "cnpj": "38.535.519/0001-47",
    "endereco": "Rua PROFESSOR ALMEIDA COUSIN, 125, SALA 718, ENSEADA DO SUA, VITORIA, ES,",
}


def _draw_logo_top_left(c, width: float, height: float) -> float:
    """Draw the Novalog logo (or text fallback) in the top-left corner.
    Returns the y coordinate just below the logo, ready for content."""
    top = height - 1.5 * cm
    if os.path.exists(LOGO_PATH):
        c.drawImage(
            LOGO_PATH,
            1.5 * cm,
            top - 1.5 * cm,
            width=4 * cm,
            height=1.5 * cm,
            preserveAspectRatio=True,
            mask="auto",
        )
        return top - 2 * cm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(1.5 * cm, top - 0.5 * cm, "NOVALOG LOGÍSTICA")
    return top - 1.5 * cm

MONTHS_PT = {
    1: "janeiro", 2: "fevereiro", 3: "março", 4: "abril",
    5: "maio", 6: "junho", 7: "julho", 8: "agosto",
    9: "setembro", 10: "outubro", 11: "novembro", 12: "dezembro",
}


def _number_to_words_brl(value: float) -> str:
    """Simple conversion for common advance amounts."""
    inteiro = int(value)
    centavos = round((value - inteiro) * 100)

    unidades = [
        "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
        "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
        "dezessete", "dezoito", "dezenove",
    ]
    dezenas = [
        "", "", "vinte", "trinta", "quarenta", "cinquenta",
        "sessenta", "setenta", "oitenta", "noventa",
    ]
    centenas = [
        "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
        "seiscentos", "setecentos", "oitocentos", "novecentos",
    ]

    def _convert_group(n: int) -> str:
        if n == 0:
            return ""
        if n == 100:
            return "cem"
        parts = []
        if n >= 100:
            parts.append(centenas[n // 100])
            n %= 100
        if n >= 20:
            parts.append(dezenas[n // 10])
            n %= 10
        if n > 0:
            parts.append(unidades[n])
        return " e ".join(parts)

    if inteiro == 0:
        result = "zero reais"
    elif inteiro == 1:
        result = "um real"
    else:
        parts = []
        if inteiro >= 1000:
            milhares = inteiro // 1000
            if milhares == 1:
                parts.append("mil")
            else:
                parts.append(f"{_convert_group(milhares)} mil")
            inteiro %= 1000

        if inteiro > 0:
            parts.append(_convert_group(inteiro))

        result = " e ".join(parts) + " reais"

    if centavos > 0:
        if centavos == 1:
            result += f" e {_convert_group(centavos)} centavo"
        else:
            result += f" e {_convert_group(centavos)} centavos"

    return result


def _format_payroll_month(payroll_month: str) -> str:
    year, month = payroll_month.split("-")
    return f"{MONTHS_PT.get(int(month), month)} de {year}"


def generate_advance_pdf(
    name: str,
    cpf: str,
    amount: float,
    advance_date: date,
    payday: int,
    payroll_month: str,
    installments: list[dict] | None = None,
) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 3 * cm

    # Logo (centered for the contract)
    if os.path.exists(LOGO_PATH):
        c.drawImage(LOGO_PATH, (width - 6 * cm) / 2, y - 1.5 * cm, width=6 * cm, height=2 * cm, preserveAspectRatio=True, mask="auto")
        y -= 3 * cm
    else:
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(width / 2, y, "NOVALOG LOGÍSTICA")
        y -= 1.5 * cm

    # Title
    y -= 1 * cm
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y, "TERMO DE ADIANTAMENTO SALARIAL")

    # Body
    y -= 2 * cm
    c.setFont("Helvetica", 10)

    amount_words = _number_to_words_brl(amount)
    month_year_str = _format_payroll_month(payroll_month)

    payer = f"{EMPLOYER['name']} (CNPJ {EMPLOYER['cnpj']})"
    has_installments = installments and len(installments) > 1
    if has_installments:
        n = len(installments)
        first_amount = float(installments[0]["amount"])
        body_text = (
            f"Eu, {name}, portador(a) do CPF {cpf}, declaro ter recebido da empresa "
            f"{payer} o valor de R$ {amount:,.2f} ({amount_words}) a título de "
            f"adiantamento salarial, parcelado em {n}x de aproximadamente "
            f"R$ {first_amount:,.2f}, a ser descontado conforme o cronograma abaixo, "
            f"com vencimento no dia {payday} de cada mês de referência."
        )
    else:
        body_text = (
            f"Eu, {name}, portador(a) do CPF {cpf}, declaro ter recebido da empresa "
            f"{payer} o valor de R$ {amount:,.2f} ({amount_words}) a título de "
            f"adiantamento salarial, a ser descontado integralmente na folha de pagamento "
            f"referente ao mês de {month_year_str}, com vencimento no dia {payday} do referido mês."
        )

    margin = 3 * cm
    text_width = width - 2 * margin
    lines = simpleSplit(body_text, "Helvetica", 10, text_width)
    for line in lines:
        c.drawString(margin, y, line)
        y -= 0.5 * cm

    if has_installments:
        y -= 0.3 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin, y, "Cronograma de descontos:")
        y -= 0.5 * cm
        c.setFont("Helvetica", 10)
        for inst in installments:
            line = (
                f"  Parcela {inst['index']}/{len(installments)} — "
                f"R$ {float(inst['amount']):,.2f} — "
                f"folha de {_format_payroll_month(inst['payroll_month'])}"
            )
            c.drawString(margin, y, line)
            y -= 0.5 * cm

    y -= 0.5 * cm
    c.drawString(
        margin, y,
        "Ao assinar este termo, autorizo expressamente o desconto do(s) valor(es) "
    )
    y -= 0.5 * cm
    c.drawString(margin, y, "mencionado(s) em minha remuneração.")

    # Date
    y -= 2 * cm
    date_str = f"{advance_date.day} de {MONTHS_PT.get(advance_date.month, '')} de {advance_date.year}"
    c.drawString(margin, y, f"Data: {date_str}")

    # Signatures
    y -= 3.5 * cm
    line_width = 7 * cm

    # Left signature (employee)
    left_x = margin
    c.line(left_x, y, left_x + line_width, y)
    c.setFont("Helvetica", 9)
    c.drawString(left_x, y - 0.5 * cm, name)
    c.drawString(left_x, y - 1 * cm, f"CPF: {cpf}")

    # Right signature (HR)
    right_x = width - margin - line_width
    c.line(right_x, y, right_x + line_width, y)
    c.drawString(right_x, y - 0.5 * cm, "Responsável RH - Novalog")

    c.save()
    return buffer.getvalue()


BENEFICIO_LABELS = {
    "alimentacao": "Vale Alimentação",
    "transporte": "Vale Transporte",
    "refeicao": "Vale Refeição",
}


def generate_benefit_receipt_pdf(
    name: str,
    cpf: str,
    pix_key: str | None,
    category: str,
    amount: float,
    payment_date: date,
    payroll_month: str,
) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = _draw_logo_top_left(c, width, height)

    margin = 2.5 * cm

    # Header date (top right)
    c.setFont("Helvetica", 9)
    date_str = f"{payment_date.day:02d}/{payment_date.month:02d}/{payment_date.year}"
    c.drawRightString(width - margin, height - 1.8 * cm, f"Data: {date_str}")

    # Title
    y -= 1.2 * cm
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y, "COMPROVANTE DE PAGAMENTO")
    y -= 0.6 * cm
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2, y, BENEFICIO_LABELS.get(category, category.capitalize()))

    # Reference
    y -= 1.4 * cm
    c.setFont("Helvetica", 10)
    ref_str = _format_payroll_month(payroll_month)
    c.drawCentredString(width / 2, y, f"Referente a {ref_str}")

    # Amount box
    y -= 1.6 * cm
    c.setFont("Helvetica-Bold", 22)
    amount_brl = (
        f"R$ {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    )
    c.drawCentredString(width / 2, y, amount_brl)
    y -= 0.6 * cm
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(width / 2, y, _number_to_words_brl(amount))

    # Details
    y -= 1.6 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Beneficiário:")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 3 * cm, y, name)

    y -= 0.55 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "CPF:")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 3 * cm, y, cpf or "—")

    y -= 0.55 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Chave PIX:")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 3 * cm, y, pix_key or "—")

    y -= 0.55 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Tipo de Benefício:")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 3 * cm, y, BENEFICIO_LABELS.get(category, category))

    y -= 0.55 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Pago por:")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 3 * cm, y, f"{EMPLOYER['name']} — CNPJ {EMPLOYER['cnpj']}")

    # Body text
    y -= 1.4 * cm
    body = (
        f"Declaro, para os devidos fins, que recebi da empresa {EMPLOYER['name']} "
        f"(CNPJ {EMPLOYER['cnpj']}) o valor acima discriminado, a título de "
        f"{BENEFICIO_LABELS.get(category, category).lower()}, referente ao mês de {ref_str}, "
        f"mediante crédito em conta/PIX informado acima. "
        f"Dou plena, geral e irrevogável quitação do referido valor."
    )
    c.setFont("Helvetica", 10)
    lines = simpleSplit(body, "Helvetica", 10, width - 2 * margin)
    for line in lines:
        c.drawString(margin, y, line)
        y -= 0.5 * cm

    # Signature
    y -= 3 * cm
    line_width = 9 * cm
    sig_x = (width - line_width) / 2
    c.line(sig_x, y, sig_x + line_width, y)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, y - 0.5 * cm, name)
    c.drawCentredString(width / 2, y - 1 * cm, f"CPF: {cpf or '—'}")

    c.save()
    return buffer.getvalue()


def generate_time_record_pdf(
    name: str,
    cpf: str | None,
    punch_at: datetime,
    notes: str | None = None,
) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = _draw_logo_top_left(c, width, height)
    margin = 2.5 * cm

    y -= 1 * cm
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y, "COMPROVANTE DE PONTO")

    y -= 1.8 * cm
    date_str = f"{punch_at.day:02d}/{punch_at.month:02d}/{punch_at.year}"
    time_str = f"{punch_at.hour:02d}:{punch_at.minute:02d}"

    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "Colaborador:")
    c.setFont("Helvetica", 12)
    c.drawString(margin + 3.5 * cm, y, name)

    y -= 0.7 * cm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, "CPF:")
    c.setFont("Helvetica", 12)
    c.drawString(margin + 3.5 * cm, y, cpf or "—")

    y -= 1.5 * cm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, y, "Data:")
    c.setFont("Helvetica", 14)
    c.drawString(margin + 3.5 * cm, y, date_str)

    y -= 0.8 * cm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, y, "Horário:")
    c.setFont("Helvetica", 14)
    c.drawString(margin + 3.5 * cm, y, time_str)

    if notes:
        y -= 1.2 * cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin, y, "Observações:")
        y -= 0.5 * cm
        c.setFont("Helvetica", 10)
        for line in simpleSplit(notes, "Helvetica", 10, width - 2 * margin):
            c.drawString(margin, y, line)
            y -= 0.45 * cm

    # Signature
    y -= 3 * cm
    line_width = 9 * cm
    sig_x = (width - line_width) / 2
    c.line(sig_x, y, sig_x + line_width, y)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, y - 0.5 * cm, name)
    c.drawCentredString(width / 2, y - 1 * cm, f"CPF: {cpf or '—'}")

    c.save()
    return buffer.getvalue()


def generate_time_records_batch_pdf(records: list[dict]) -> bytes:
    """Multi-page PDF, one comprovante per record (each record dict has name, cpf,
    punch_at datetime, notes optional)."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 2.5 * cm

    for i, rec in enumerate(records):
        y = _draw_logo_top_left(c, width, height)
        y -= 1 * cm
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(width / 2, y, "COMPROVANTE DE PONTO")

        y -= 1.8 * cm
        punch_at = rec["punch_at"]
        date_str = f"{punch_at.day:02d}/{punch_at.month:02d}/{punch_at.year}"
        time_str = f"{punch_at.hour:02d}:{punch_at.minute:02d}"

        c.setFont("Helvetica-Bold", 12)
        c.drawString(margin, y, "Colaborador:")
        c.setFont("Helvetica", 12)
        c.drawString(margin + 3.5 * cm, y, rec.get("name") or "—")

        y -= 0.7 * cm
        c.setFont("Helvetica-Bold", 12)
        c.drawString(margin, y, "CPF:")
        c.setFont("Helvetica", 12)
        c.drawString(margin + 3.5 * cm, y, rec.get("cpf") or "—")

        y -= 1.5 * cm
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin, y, "Data:")
        c.setFont("Helvetica", 14)
        c.drawString(margin + 3.5 * cm, y, date_str)

        y -= 0.8 * cm
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin, y, "Horário:")
        c.setFont("Helvetica", 14)
        c.drawString(margin + 3.5 * cm, y, time_str)

        notes = rec.get("notes")
        if notes:
            y -= 1.2 * cm
            c.setFont("Helvetica-Bold", 10)
            c.drawString(margin, y, "Observações:")
            y -= 0.5 * cm
            c.setFont("Helvetica", 10)
            for line in simpleSplit(notes, "Helvetica", 10, width - 2 * margin):
                c.drawString(margin, y, line)
                y -= 0.45 * cm

        y -= 3 * cm
        line_width = 9 * cm
        sig_x = (width - line_width) / 2
        c.line(sig_x, y, sig_x + line_width, y)
        c.setFont("Helvetica", 9)
        c.drawCentredString(width / 2, y - 0.5 * cm, rec.get("name") or "—")
        c.drawCentredString(width / 2, y - 1 * cm, f"CPF: {rec.get('cpf') or '—'}")

        if i < len(records) - 1:
            c.showPage()

    c.save()
    return buffer.getvalue()


# ============================================================
# REGISTRO DE EMPREGADO (JPX DO BRASIL)
# ============================================================

# Fields required before the document can be generated.
# Employee provides personal data; RH provides work data.
REGISTRO_REQUIRED_EMPLOYEE = [
    ("name", "Nome do empregado"),
    ("residencia", "Residência"),
    ("date_of_birth", "Data de nascimento"),
    ("local_nascimento", "Local de nascimento"),
    ("pais_nacionalidade", "País de nacionalidade"),
    ("estado_civil", "Estado civil"),
    ("filiacao_pai", "Filiação (pai)"),
    ("filiacao_mae", "Filiação (mãe)"),
    ("orgao_emissor", "Órgão emissor"),
    ("cpf", "CPF"),
    ("grau_instrucao", "Grau de instrução"),
    ("sexo", "Sexo"),
    ("cor", "Cor"),
    ("deficiencia", "Deficiência"),
    ("pix_key", "Chave PIX"),
]
REGISTRO_REQUIRED_RH = [
    ("data_admissao", "Data de admissão"),
    ("base_salary", "Salário"),
    ("salario_por", "Por (Mês/Hora/...)"),
    ("horario_trabalho", "Horário de trabalho"),
    ("horario_intervalo", "Horário de intervalo"),
    ("fgts_opcao_em", "FGTS - Opção em"),
]


def missing_registro_fields(emp: dict) -> list[str]:
    """Return human labels of required fields still missing."""
    missing = []
    for key, label in REGISTRO_REQUIRED_EMPLOYEE + REGISTRO_REQUIRED_RH:
        v = emp.get(key)
        if v is None or (isinstance(v, str) and not v.strip()):
            missing.append(label)
    # At least one phone number
    if not (emp.get("telefone_residencial") or emp.get("telefone_celular")):
        missing.append("Telefone (fixo ou celular)")
    return missing


def generate_employee_record_pdf(emp: dict) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    c.setLineWidth(0.6)

    LEFT = 16
    RIGHT = width - 16  # 579.27
    W = RIGHT - LEFT

    def g(key: str) -> str:
        v = emp.get(key)
        return "" if v is None else str(v)

    def fmt_date(key: str) -> str:
        v = emp.get(key)
        if not v:
            return ""
        try:
            d = date.fromisoformat(str(v)[:10])
            return f"{d.day:02d}/{d.month:02d}/{d.year}"
        except Exception:
            return str(v)

    def fit(text: str, max_w: float, size: float, bold: bool):
        font = "Helvetica-Bold" if bold else "Helvetica"
        s = size
        while s > 6 and stringWidth(text, font, s) > max_w:
            s -= 0.5
        while text and stringWidth(text, font, s) > max_w:
            text = text[:-1]
        return text, s

    def cell(x, top, w, h, label=None, value="", value_bold=False,
             center=False, value_size=8.5, inline=False):
        yb = height - top - h
        c.rect(x, yb, w, h)
        if inline:
            # label and value share a baseline (used for tall-value short rows)
            c.setFont("Helvetica-Bold", 6)
            lw = stringWidth(label, "Helvetica-Bold", 6) if label else 0
            by = yb + (h - 8) / 2
            if label:
                c.drawString(x + 3, by, label)
            if value:
                t, s = fit(str(value), w - lw - 10, 8.5, value_bold)
                c.setFont("Helvetica-Bold" if value_bold else "Helvetica", s)
                c.drawString(x + 3 + lw + 4, by, t)
            return
        if label:
            c.setFont("Helvetica", 5.2)
            c.drawString(x + 2, height - top - 7, label)
        if value:
            font = "Helvetica-Bold" if value_bold else "Helvetica"
            # cap size so the value ascender never collides with the top label
            max_s = max(6.0, (h - 10) / 0.72) if label else value_size
            t, s = fit(str(value), w - 6, min(value_size, max_s), value_bold)
            c.setFont(font, s)
            vy = yb + (3 if label else (h - s) / 2)
            if center:
                c.drawCentredString(x + w / 2, vy, t)
            else:
                c.drawString(x + 3, vy, t)

    def band(x, top, w, h, text, size=6.5):
        yb = height - top - h
        c.rect(x, yb, w, h)
        c.setFont("Helvetica-Bold", size)
        c.drawCentredString(x + w / 2, yb + (h - size) / 2 + 1, text)

    # --- Title ---
    top = 18
    band(LEFT, top, W, 20, "REGISTRO DE EMPREGADO", size=12)
    top += 20

    # --- Row 1: Autenticar | (Matrícula/Nº, Empregador/CNPJ, Endereço) ---
    matricula = g("matricula_esocial")
    numero = matricula.zfill(6) if matricula.isdigit() else matricula
    cell(LEFT, top, 150, 58, "Autenticar")
    rx = LEFT + 150  # 166
    cell(rx, top, 330, 18, "Matrícula eSocial", matricula)
    cell(rx + 330, top, 83, 18, "Nº", numero, center=True, value_bold=True)
    cell(rx, top + 18, 330, 22, "Empregador", EMPLOYER["name"], value_bold=True)
    cell(rx + 330, top + 18, 83, 22, "CNPJ", EMPLOYER["cnpj"])
    cell(rx, top + 40, 413, 18, "Endereço", EMPLOYER["endereco"])
    top += 58

    # --- Empregado | Beneficiários ---
    cell(LEFT, top, 360, 26, "Empregado", g("name"), value_bold=True, value_size=11)
    cell(LEFT + 360, top, W - 360, 26, "Beneficiários", g("beneficiarios"))
    top += 26

    # --- Residência ---
    cell(LEFT, top, W, 28, "Residência", g("residencia"))
    top += 28

    # --- Middle block: photo box on left + data grid ---
    grid_x = LEFT + 66  # 82
    GW = RIGHT - grid_x  # 497
    grid_top = top
    cell(LEFT, top, 66, 164)  # photo / authentication box

    # R_a
    widths = [110, 150, 130, GW - 390]
    x = grid_x
    cell(x, top, widths[0], 22, "Data de nascimento", fmt_date("date_of_birth")); x += widths[0]
    cell(x, top, widths[1], 22, "Local do nascimento", g("local_nascimento")); x += widths[1]
    cell(x, top, widths[2], 22, "País da nacionalidade", g("pais_nacionalidade")); x += widths[2]
    cell(x, top, widths[3], 22, "Estado civil", g("estado_civil"))
    top += 22
    # R_b / R_c filiação (inline label so value doesn't collide on short rows)
    cell(grid_x, top, GW, 16, "Filiação — Pai:", g("filiacao_pai"), inline=True); top += 16
    cell(grid_x, top, GW, 16, "Mãe:", g("filiacao_mae"), inline=True); top += 16
    # R_d
    widths = [80, 60, 70, 80, 40, 40, GW - 370]
    labels = ["Cédula de Identidade", "Data de emissão", "Órgão/UF emissor",
              "Título Eleitoral", "Zona", "Seção", "Inscr. Órgão de Classe"]
    keys = ["cedula_identidade", "rg_data_emissao", "orgao_emissor",
            "titulo_eleitoral", "titulo_zona", "titulo_secao", "inscr_orgao_classe"]
    x = grid_x
    for wdt, lb, ky in zip(widths, labels, keys):
        cell(x, top, wdt, 22, lb, g(ky)); x += wdt
    top += 22
    # R_e
    widths = [70, 45, 80, 40, 95, 95, GW - 425]
    labels = ["CTPS", "Série", "Data de expedição da CTPS", "UF CTPS", "CPF",
              "Cart. Nac. Habilitação", "Categoria"]
    keys = ["ctps", "ctps_serie", "ctps_data_expedicao", "ctps_uf", "cpf",
            "cnh", "cnh_categoria"]
    x = grid_x
    for wdt, lb, ky in zip(widths, labels, keys):
        cell(x, top, wdt, 22, lb, g(ky)); x += wdt
    top += 22
    # R_f
    widths = [85, 70, 80, 90, GW - 325]
    labels = ["Doc. militar", "Categoria", "Cor", "Sexo", "Grau de instrução"]
    keys = ["doc_militar", "doc_militar_categoria", "cor", "sexo", "grau_instrucao"]
    x = grid_x
    for wdt, lb, ky in zip(widths, labels, keys):
        cell(x, top, wdt, 22, lb, g(ky)); x += wdt
    top += 22
    # R_g
    widths = [120, 180, GW - 300]
    labels = ["Deficiência", "Telefone Residencial", "Telefone Celular"]
    keys = ["deficiencia", "telefone_residencial", "telefone_celular"]
    x = grid_x
    for wdt, lb, ky in zip(widths, labels, keys):
        cell(x, top, wdt, 22, lb, g(ky)); x += wdt
    top += 22
    # R_h
    cell(grid_x, top, 230, 22, "Cargo", g("cargo"), value_bold=True)
    cell(grid_x + 230, top, 190, 22, "Função", g("funcao"))
    cell(grid_x + 420, top, GW - 420, 22, "C.B.O.", g("cbo"))
    top = grid_top + 164

    # --- Admissão row ---
    salario = emp.get("base_salary")
    salario_str = ""
    if salario:
        salario_str = (
            f"R$ {float(salario):,.2f}"
            .replace(",", "X").replace(".", ",").replace("X", ".")
        )
    widths = [95, 105, 70, 150, W - 420]
    labels = ["Data de Admissão", "Salário", "Por", "Horário de Trabalho",
              "Horário de Intervalo"]
    vals = [fmt_date("data_admissao"), salario_str, g("salario_por"),
            g("horario_trabalho"), g("horario_intervalo")]
    x = LEFT
    for wdt, lb, vl in zip(widths, labels, vals):
        cell(x, top, wdt, 26, lb, vl); x += wdt
    top += 26

    # --- FGTS row ---
    cell(LEFT, top, 46, 22, "FGTS")
    cell(LEFT + 46, top, 110, 22, "Opção em", fmt_date("fgts_opcao_em"))
    cell(LEFT + 156, top, 220, 22, "Conta vinculada no banco", g("conta_vinculada_banco"))
    cell(LEFT + 376, top, W - 376, 22, "Data da Ratificação", g("data_ratificacao"))
    top += 22

    # --- PIS section ---
    band(LEFT, top, W, 12, "PROGRAMA DE INTEGRAÇÃO SOCIAL - PIS", size=6.5)
    top += 12
    cell(LEFT, top, 160, 18, "Cadastrado em", g("pis_cadastrado_em"))
    cell(LEFT + 160, top, 140, 18, "Sob nº", g("pis_sob_n"))
    cell(LEFT + 300, top, W - 300, 18, "Domicílio bancário", g("pis_domicilio_bancario"))
    top += 18
    cell(LEFT, top, 160, 18, "Nº banco", g("pis_n_banco"))
    cell(LEFT + 160, top, 140, 18, "Agência código", g("pis_agencia_codigo"))
    cell(LEFT + 300, top, W - 300, 18, "End. da agência", g("pis_end_agencia"))
    top += 18

    # --- Alterações (blank) ---
    band(LEFT, top, W, 12, "ALTERAÇÕES DE SALÁRIO, CARGO E/OU FUNÇÃO", size=6.5)
    top += 12
    cell(LEFT, top, W, 80)
    c.line(LEFT + W / 2, height - top - 80, LEFT + W / 2, height - top)
    top += 80

    # --- Férias + Obs (blank) ---
    fw = [120, 120, 120, W - 360]
    flabels = ["FÉRIAS - PERÍODO AQUISITIVO", "FÉRIAS - PERÍODO DE GOZO",
               "FÉRIAS - PERÍODO ABONO PECUNIÁRIO",
               "Obs.: (Anotar advertências, suspensões, transferências, etc.)"]
    x = LEFT
    for i, (wdt, lb) in enumerate(zip(fw, flabels)):
        yb = height - top - 80
        c.rect(x, yb, wdt, 80)
        c.setFont("Helvetica", 5.0)
        # wrap label inside narrow header
        for li, line in enumerate(simpleSplit(lb, "Helvetica", 5.0, wdt - 4)):
            c.drawString(x + 2, height - top - 7 - li * 6, line)
        if i == 3:  # obs lines
            for ln in range(1, 6):
                ly = yb + 80 - 22 - ln * 11
                if ly > yb + 4:
                    c.line(x + 4, ly, x + wdt - 4, ly)
        x += wdt
    top += 80

    # --- Acidentes | Rescisão (blank) ---
    cell(LEFT, top, 300, 88)
    c.setFont("Helvetica", 5.2)
    for li, line in enumerate(simpleSplit(
            "ACIDENTES DE TRABALHO, DOENÇAS OU DOENÇAS PROFISSIONAIS",
            "Helvetica", 5.2, 296)):
        c.drawCentredString(LEFT + 150, height - top - 7 - li * 6, line)
    cell(LEFT + 300, top, W - 300, 88)
    c.setFont("Helvetica-Bold", 5.5)
    c.drawCentredString(LEFT + 300 + (W - 300) / 2, height - top - 8,
                        "RESCISÃO DE CONTRATO DE TRABALHO")
    c.setFont("Helvetica", 7)
    rxx = LEFT + 306
    ry = height - top - 26
    c.drawString(rxx, ry, "Data da saída:")
    c.drawString(rxx, ry - 16, "Data aviso ind.:")
    c.drawString(rxx + 120, ry - 16, "Data projeção:")
    c.drawString(rxx, ry - 32, "Tipo do desligamento:")
    top += 88

    # --- Contribuição Sindical | Assinaturas ---
    cell(LEFT, top, 300, 90)
    c.setFont("Helvetica-Bold", 5.5)
    c.drawCentredString(LEFT + 150, height - top - 8, "CONTRIBUIÇÃO SINDICAL")
    # right signatures (open area, just rect border)
    c.rect(LEFT + 300, height - top - 90, W - 300, 90)
    sig_cx = LEFT + 300 + (W - 300) / 2
    c.setFont("Helvetica", 8.5)
    # signature lines sit ABOVE each name (space to sign by hand)
    c.line(sig_cx - 120, height - top - 38, sig_cx + 120, height - top - 38)
    c.drawCentredString(sig_cx, height - top - 48, g("name"))
    c.line(sig_cx - 120, height - top - 72, sig_cx + 120, height - top - 72)
    c.drawCentredString(sig_cx, height - top - 82, EMPLOYER["name"])
    top += 90

    # --- Observações footer ---
    band(LEFT, top, W, 12, "OBSERVAÇÕES", size=6.5)

    c.save()
    return buffer.getvalue()
