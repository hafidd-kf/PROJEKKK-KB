"""Entry point WSGI (gunicorn / PythonAnywhere / cPanel Passenger)."""
from app import app

application = app  # nama 'application' dipakai cPanel/Passenger & PythonAnywhere
