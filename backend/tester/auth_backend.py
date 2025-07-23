"""Custom authentication backends for the tester app."""

from django.http import HttpRequest

from .models import CustomUser


class EmailAuthBackend:
    """Custom authentication backend.

    Authenticates users based on email address and password.
    """

    def authenticate(
        self,
        _request: HttpRequest,
        username: str | None = None,
        email: str | None = None,
        password: str | None = None,
        **kwargs,
    ) -> CustomUser | None:
        """Authenticate a user by email and password.

        Args:
            _request: The HttpRequest object (unused).
            username: The username (treated as email for Django admin compatibility).
            email: The user's email address.
            password: The user's password.

        Returns:
            The user object if authentication is successful, otherwise None.
        """
        # Django admin passes the email as 'username', so we prioritize that
        # If username is provided, use it as email (for Django admin)
        # Otherwise, use the email parameter (for your app)
        user_email = username or email

        if not user_email or not password:
            return None

        try:
            user = CustomUser.objects.get(email=user_email)
            if user.check_password(password) and self.user_can_authenticate(user):
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

    def user_can_authenticate(self, user):
        """Check if the user is allowed to authenticate.

        Reject users with is_active=False. Custom user models that don't have
        an is_active field are allowed.
        """
        return getattr(user, "is_active", True)
