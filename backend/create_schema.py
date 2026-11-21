"""Create the initial MirrorFlix schema in a confirmed empty database.

This command is intentionally separate from API startup. It refuses to run
unless the caller names the expected database and that database has no tables.
"""

import argparse

from sqlalchemy import inspect

try:
    from backend.database import Base, engine
    from backend import models as _models  # register model metadata
except ModuleNotFoundError as exc:
    if exc.name != "backend":
        raise
    from database import Base, engine
    import models as _models  # register model metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm-empty-database",
        required=True,
        help="must exactly match the configured database name",
    )
    args = parser.parse_args()

    if engine.url.database != args.confirm_empty_database:
        raise SystemExit("Configured database name did not match the confirmation")

    existing_tables = inspect(engine).get_table_names()
    if existing_tables:
        raise SystemExit(
            "Refusing to initialize a database that already contains tables: "
            + ", ".join(existing_tables)
        )

    Base.metadata.create_all(engine)
    print(f"Created {len(Base.metadata.tables)} MirrorFlix tables in {engine.url.database}")


if __name__ == "__main__":
    main()
