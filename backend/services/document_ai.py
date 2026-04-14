import anthropic
import base64
import json
from config import settings


def extract_driver_info(file_bytes: bytes, content_type: str) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")

    # Determine media type
    if "pdf" in content_type:
        media_type = "application/pdf"
    elif "png" in content_type:
        media_type = "image/png"
    else:
        media_type = "image/jpeg"

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extraia as seguintes informações deste documento brasileiro. "
                            "Retorne APENAS um JSON válido com estes campos:\n"
                            "- name: nome completo\n"
                            "- cpf: CPF no formato 000.000.000-00\n"
                            "- date_of_birth: data de nascimento no formato YYYY-MM-DD\n"
                            "- phone: telefone (se disponível)\n\n"
                            "Se algum campo não estiver disponível, use null. "
                            "Retorne APENAS o JSON, sem explicações."
                        ),
                    },
                ],
            }
        ],
    )

    text = message.content[0].text.strip()
    # Try to parse JSON from the response
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "name": None,
            "cpf": None,
            "date_of_birth": None,
            "phone": None,
            "error": "Não foi possível extrair as informações do documento.",
        }
