"""Seed the service dependency registry (who calls whom).
Usage:  python seed_registry.py <owner/repo>
Example: python seed_registry.py tharangajw/rp-core-product
"""
import sys

from app import db

if len(sys.argv) < 2:
    sys.exit("Usage: python seed_registry.py <owner/repo>")

db.init_db()
repo = db.add_repo(sys.argv[1])

# consumer -> provider  (found from the demo app's source code)
DEPENDENCIES = [
    ("order-service", "book-service"),
    ("order-service", "user-service"),
    ("gateway", "book-service"),
    ("gateway", "user-service"),
    ("gateway", "order-service"),
]
for consumer, provider in DEPENDENCIES:
    db.add_dependency(repo["id"], consumer, provider)
    print(f"{consumer} -> {provider}")
print("Registry seeded for", sys.argv[1])
