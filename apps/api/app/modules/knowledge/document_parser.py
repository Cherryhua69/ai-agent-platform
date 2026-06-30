import re
from io import BytesIO
from typing import Protocol

import pypdfium2


class DocumentParser(Protocol):
    def parse(self, *, name: str, mime_type: str, content: str | None) -> str:
        """解析文档原始内容，返回可切分的纯文本。"""


class BasicDocumentParser:
    _markdown_heading_pattern = re.compile(r"^\s{0,3}#{1,6}\s+", flags=re.MULTILINE)
    _markdown_list_pattern = re.compile(r"^[ \t]*[-*+]\s+", flags=re.MULTILINE)

    def parse(self, *, name: str, mime_type: str, content: str | None) -> str:
        normalized_content = (content or "").strip()
        normalized_mime_type = mime_type.lower().split(";")[0].strip()
        lowered_name = name.lower()

        if not normalized_content:
            return ""

        if normalized_mime_type in {"text/plain", "text/txt"} or lowered_name.endswith(".txt"):
            return normalized_content

        if normalized_mime_type == "application/pdf" or lowered_name.endswith(".pdf"):
            return normalized_content

        if normalized_mime_type in {"text/markdown", "text/x-markdown"} or lowered_name.endswith((".md", ".markdown")):
            return self._parse_markdown(normalized_content)

        raise ValueError(f"unsupported document type: {normalized_mime_type or 'unknown'}")

    def _parse_markdown(self, content: str) -> str:
        parsed = self._markdown_heading_pattern.sub("", content)
        parsed = self._markdown_list_pattern.sub("", parsed)
        return parsed.strip()


def extract_pdf_text(raw_content: bytes) -> str:
    try:
        pdf_reader = pypdfium2.PdfDocument(BytesIO(raw_content), autoclose=True)
        try:
            pages: list[str] = []
            for page in pdf_reader:
                text_page = page.get_textpage()
                content = text_page.get_text_range().strip()
                text_page.close()
                page.close()
                if content:
                    pages.append(content)
            return "\n\n".join(pages)
        finally:
            pdf_reader.close()
    except Exception as exc:
        raise ValueError("Document parse failed") from exc
