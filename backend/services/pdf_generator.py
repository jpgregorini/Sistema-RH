from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit
from datetime import date, datetime
import io
import os


LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-novalog.png")


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

    has_installments = installments and len(installments) > 1
    if has_installments:
        n = len(installments)
        first_amount = float(installments[0]["amount"])
        body_text = (
            f"Eu, {name}, portador(a) do CPF {cpf}, declaro ter recebido da empresa "
            f"Novalog Logística o valor de R$ {amount:,.2f} ({amount_words}) a título de "
            f"adiantamento salarial, parcelado em {n}x de aproximadamente "
            f"R$ {first_amount:,.2f}, a ser descontado conforme o cronograma abaixo, "
            f"com vencimento no dia {payday} de cada mês de referência."
        )
    else:
        body_text = (
            f"Eu, {name}, portador(a) do CPF {cpf}, declaro ter recebido da empresa "
            f"Novalog Logística o valor de R$ {amount:,.2f} ({amount_words}) a título de "
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
    c.drawCentredString(width / 2, y, f"R$ {amount:,.2f}")
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

    # Body text
    y -= 1.4 * cm
    body = (
        f"Declaro, para os devidos fins, que recebi da empresa Novalog Logística o valor "
        f"acima discriminado, a título de {BENEFICIO_LABELS.get(category, category).lower()}, "
        f"referente ao mês de {ref_str}, mediante crédito em conta/PIX informado acima. "
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
