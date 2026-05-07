"""Split SaaS SQL into MCP-sized apply_migration payloads (written as JSON lines)."""
import json
import pathlib

root = pathlib.Path(__file__).resolve().parents[1]
full = (root / "supabase/migrations/20260430120000_saas_core.sql").read_text(encoding="utf-8")

# Part A: tables + indexes (up to first -- New user)
idx = full.index("-- ---------------------------------------------------------------------------\n-- New user:")
part_a = full[:idx].strip()

# Part B: trigger + functions + grants (up to RLS section)
idx2 = full.index("-- ---------------------------------------------------------------------------\n-- RLS")
part_b = full[idx:idx2].strip()

# Part C: RLS
part_c = full[idx2:].strip()

# Fix trigger for broader PG compatibility (Supabase uses PG15; EXECUTE FUNCTION is valid)
part_b = part_b.replace(
    "execute function public.handle_new_user ();",
    "execute procedure public.handle_new_user ();",
)

out = root / "scripts" / "mcp_migrations.jsonl"
out.parent.mkdir(parents=True, exist_ok=True)
parts = [
    ("saas_core_tables", part_a),
    ("saas_core_functions", part_b),
    ("saas_core_rls", part_c),
]
with out.open("w", encoding="utf-8") as f:
    for name, query in parts:
        f.write(json.dumps({"name": name, "query": query}, ensure_ascii=False) + "\n")

# Storage + ensure (small)
for fname, mname in [
    ("20260430120100_storage_kb.sql", "storage_kb_bucket"),
    ("20260430120200_ensure_org.sql", "ensure_my_organization_fn"),
]:
    q = (root / "supabase/migrations" / fname).read_text(encoding="utf-8")
    with out.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"name": mname, "query": q}, ensure_ascii=False) + "\n")

print("Wrote", out, "lines:", 3 + 2)
