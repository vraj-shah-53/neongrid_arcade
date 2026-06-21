from django.core.signing import BadSignature, SignatureExpired
from django.contrib.auth.models import User
from django.utils.deprecation import MiddlewareMixin
from django.core import signing
import logging

logger = logging.getLogger(__name__)

class TokenAuthMiddleware(MiddlewareMixin):
    def process_request(self, request):
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                # Decrypt/verify token (valid for 30 days)
                data = signing.loads(token, max_age=30 * 24 * 3600)
                user_id = data.get('user_id')
                if user_id:
                    user = User.objects.filter(id=user_id).first()
                    if user:
                        request.user = user
                        # Disable CSRF check for requests authenticated via Token
                        request._dont_enforce_csrf_checks = True
            except signing.SignatureExpired:
                logger.warning("Token expired")
            except signing.BadSignature:
                logger.warning("Token signature is invalid")
