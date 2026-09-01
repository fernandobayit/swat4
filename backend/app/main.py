from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, groups, shares, ous, logs, dns, activities, bulk, domain, roles
from app.exceptions import SambaToolError
from app.database import init_db
from fastapi.responses import JSONResponse
from fastapi import Request
app = FastAPI(
    title="SWAT4 - Samba 4 Web Administration Tool",
    description="API for managing Samba 4 Active Directory",
    version="1.0.0",
)

@app.on_event("startup")
def startup_event():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])

app.include_router(shares.router, prefix="/api/shares", tags=["Shares"])
app.include_router(ous.router, prefix="/api/ous", tags=["Organizational Units"])
app.include_router(logs.router, prefix="/api/logs", tags=["Logs"])
app.include_router(dns.router, prefix="/api/dns", tags=["DNS"])
app.include_router(activities.router, prefix="/api/activities", tags=["Activities"])
app.include_router(bulk.router, prefix="/api/bulk", tags=["Bulk"])
app.include_router(domain.router, prefix="/api/domain", tags=["Domain"])
app.include_router(roles.router, prefix="/api/roles", tags=["Roles"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "swat4-backend"}


@app.exception_handler(SambaToolError)
async def samba_tool_exception_handler(request: Request, exc: SambaToolError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )
