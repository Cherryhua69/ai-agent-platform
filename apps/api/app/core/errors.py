class AppError(Exception):
    """应用层基础异常。"""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)
