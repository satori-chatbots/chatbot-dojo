"""Custom authentication backends for the tester app."""

from django.http import HttpRequest

from .models import CustomUser


class EmailAuthBackend:
    """Custom authentication backend.

    Authenticates users based on email address and password.
    """

    def authenticate(
        self, _request: HttpRequest, email: str | None = None, password: str | None = None
    ) -> CustomUser | None:
        """Authenticate a user by email and password.

        Args:
            _request: The HttpRequest object (unused).
            email: The user's email address.
            password: The user's password.

        Returns:
            The user object if authentication is successful, otherwise None.
        """
        try:
            user = CustomUser.objects.get(email=email)
            if user.check_password(password):
                return user
        except CustomUser.DoesNotExist:
            return None
        return None

    def get_user(self, user_id: int) -> CustomUser | None:
        """Retrieve a user instance from the database by their ID.

        Args:
            user_id: The primary key of the user to retrieve.

        Returns:
            The user object if found, otherwise None.
        """
        try:
            return CustomUser.objects.get(pk=user_id)
        except CustomUser.DoesNotExist:
            return None
