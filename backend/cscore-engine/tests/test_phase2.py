from app import phase2

OLD_SPEC = """openapi: 3.0.3
info: {title: T, version: 1.0.0}
paths:
  /books:
    get:
      responses:
        "200": {description: OK}
  /books/{id}:
    parameters:
      - {name: id, in: path, required: true, schema: {type: string}}
    delete:
      responses:
        "200": {description: OK}
"""

# new spec: DELETE /books/{id} removed -> breaking change
NEW_SPEC = """openapi: 3.0.3
info: {title: T, version: 1.0.0}
paths:
  /books:
    get:
      responses:
        "200": {description: OK}
"""


def test_oasdiff_detects_removed_endpoint():
    count, messages = phase2.count_breaking_changes(OLD_SPEC, OLD_SPEC)
    assert count == 0
    count, messages = phase2.count_breaking_changes(OLD_SPEC, NEW_SPEC)
    print(messages)
    assert count >= 1
