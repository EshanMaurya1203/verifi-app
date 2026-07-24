import os

base_dir = r"c:\Users\eshan\Downloads\verifi-app"

def get_files_in_dir(rel_path):
    abs_dir = os.path.join(base_dir, rel_path)
    if not os.path.exists(abs_dir):
        return []
    res = []
    for f in os.listdir(abs_dir):
        if os.path.isfile(os.path.join(abs_dir, f)):
            res.append(os.path.join(rel_path, f).replace("\\", "/"))
    return res

dashboard_components = get_files_in_dir("src/components/founder-dashboard")
dashboard_lib = get_files_in_dir("src/lib/dashboard")

files = []
files.extend(["src/app/dashboard/layout.tsx", "src/app/dashboard/page.tsx", "src/app/dashboard/billing/page.tsx"])
files.extend(dashboard_components)
files.extend(["src/app/api/startup/[id]/overview/route.ts", "src/app/api/startup/[id]/sync/route.ts"])
files.extend(dashboard_lib)
files.extend([
    "src/lib/scoring.ts",
    "src/lib/verification-state.ts",
    "src/lib/verification-data.ts",
    "src/lib/revenue-aggregation.ts",
    "src/lib/formatters.ts",
    "middleware.ts",
    "src/lib/supabase/middleware.ts",
    "src/lib/supabase-server.ts",
    "supabase/migrations/20240416000000_revenue_tracking.sql",
    "supabase/migrations/20240416000003_v2_verification_engine.sql",
    "supabase/migrations/20240416000004_fraud_detection.sql",
    "supabase/migrations/20240416000011_provider_connections.sql",
    "supabase/migrations/20260420124038_historical_snapshots.sql"
])

out_file = os.path.join(base_dir, "FOUNDER_DASHBOARD_IMPLEMENTATION_AUDIT.md")

has_error = False

with open(out_file, "w", encoding="utf-8") as out:
    out.write("# Founder Dashboard Implementation Audit\n\n")
    out.write("This document contains the complete implementation of the Founder Dashboard, including rendering, fetching, updating logic, utilities, formatting, routing, auth/middleware, and SQL schemas.\n\n")
    
    out.write("## File Inventory\n")
    for f in files:
        out.write(f"- `{f}`\n")
    out.write("\n---\n\n")
    
    for f in files:
        file_path = os.path.join(base_dir, f)
        
        # Determine language for markdown code block
        lang = "typescript"
        if f.endswith(".tsx"):
            lang = "tsx"
        elif f.endswith(".sql"):
            lang = "sql"
        
        out.write(f"## `{f}`\n\n")
        out.write(f"```{lang}\n")
        try:
            with open(file_path, "r", encoding="utf-8") as infile:
                content = infile.read()
                out.write(content)
                if not content.endswith("\n"):
                    out.write("\n")
        except Exception as e:
            out.write(f"// Error reading file: {str(e)}\n")
            has_error = True
            print(f"Error reading {file_path}: {e}")
        
        out.write("```\n\n")

if has_error:
    print("FINISHED WITH ERRORS")
else:
    print(f"Created {out_file} successfully.")
