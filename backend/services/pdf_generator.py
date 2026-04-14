from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from datetime import date
import io
import os

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


def generate_advance_pdf(
    name: str,
    cpf: str,
    amount: float,
    advance_date: date,
    payday: int,
    payroll_month: str,
) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 3 * cm

    # Logo placeholder — check if logo file exists
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "logo-novalog.png")
    if os.path.exists(logo_path):
        c.drawImage(logo_path, (width - 6 * cm) / 2, y - 1.5 * cm, width=6 * cm, height=2 * cm, preserveAspectRatio=True)
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
    year_month = payroll_month.split("-")
    month_name = MONTHS_PT.get(int(year_month[1]), year_month[1])
    month_year_str = f"{month_name} de {year_month[0]}"

    body_text = (
        f"Eu, {name}, portador(a) do CPF {cpf}, declaro ter recebido da empresa "
        f"Novalog Logística o valor de R$ {amount:,.2f} ({amount_words}) a título de "
        f"adiantamento salarial, a ser descontado integralmente na folha de pagamento "
        f"referente ao mês de {month_year_str}, com vencimento no dia {payday} do referido mês."
    )

    # Word wrap
    from reportlab.lib.utils import simpleSplit
    margin = 3 * cm
    text_width = width - 2 * margin
    lines = simpleSplit(body_text, "Helvetica", 10, text_width)
    for line in lines:
        c.drawString(margin, y, line)
        y -= 0.5 * cm

    y -= 0.5 * cm
    c.drawString(
        margin, y,
        "Ao assinar este termo, autorizo expressamente o desconto do valor acima "
    )
    y -= 0.5 * cm
    c.drawString(margin, y, "mencionado em minha remuneração.")

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
