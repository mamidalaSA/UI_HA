"""Import every module's models so Base.metadata is fully populated before
Alembic autogenerate runs or `Base.metadata.create_all` is called. Order matters
only for readability here — SQLAlchemy resolves FK targets lazily.
"""

from app.modules.admin import models as admin_models  # noqa: F401
from app.modules.alerts import models as alerts_models  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.auth import otp_models as auth_otp_models  # noqa: F401
from app.modules.doctors import models as doctors_models  # noqa: F401
from app.modules.labs import models as labs_models  # noqa: F401
from app.modules.nurses import models as nurses_models  # noqa: F401
from app.modules.patients import models as patients_models  # noqa: F401
from app.modules.pharmacy import models as pharmacy_models  # noqa: F401
from app.modules.transfers import models as transfers_models  # noqa: F401
