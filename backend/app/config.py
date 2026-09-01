from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Samba/LDAP
    samba_dc_host: str = "samba-dc"
    samba_realm: str = "SWAT.LOCAL"
    samba_domain: str = "SWAT"
    samba_base_dn: str = "DC=swat,DC=local"
    ldap_url: str = "ldap://samba-dc:389"
    samba_admin_user: str = "administrator"
    samba_admin_password: str = ""  # MUST be set via SAMBA_ADMIN_PASSWORD env var

    # JWT
    jwt_secret: str = ""  # MUST be set via JWT_SECRET env var
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    # Logs
    samba_log_path: str = "/var/log/samba"

    # Auth
    allowed_login_groups: str = "Domain Admins,Account Operators"

    @property
    def allowed_groups_list(self) -> List[str]:
        return [g.strip() for g in self.allowed_login_groups.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
