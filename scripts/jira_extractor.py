import os
import requests
from requests.auth import HTTPBasicAuth
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

JIRA_DOMAIN = os.getenv("JIRA_DOMAIN")  # e.g. "yourdomain.atlassian.net"
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_and_sync():
    url = f"https://{JIRA_DOMAIN}/rest/api/3/search/jql"
    auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN)
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    # Using POST requires sending the parameters as a JSON payload
    payload = {
        "jql": 'project = KAN ORDER BY created DESC',
        "expand": "changelog", 
        "fields": ["summary", "status", "assignee", "created"],
        "maxResults": 100
    }

    print(f"Connecting to Jira via POST: {url}")
    response = requests.post(url, headers=headers, json=payload, auth=auth)
    # Replace response.raise_for_status() with this error catcher
    if not response.ok:
        print(f"Jira API Error {response.status_code}: {response.text}")
        return
    
    jira_data = response.json()
    issues = jira_data.get("issues", [])
    print(f"Jira returned {len(issues)} issues.")
    
    if len(issues) == 0:
        print("Raw Jira Response:", jira_data)
        return

    for issue in issues:
        key = issue["key"]
        fields = issue.get("fields", {})
        
        prospect_payload = {
            "issue_key": key,
            "summary": fields.get("summary", ""),
            "assignee": fields.get("assignee", {}).get("displayName", "Unassigned") if fields.get("assignee") else "Unassigned",
            "current_status": fields.get("status", {}).get("name", "") if fields.get("status") else "",
            "created_at": fields.get("created")
        }
        
        supabase.table("nmmsb_prospects").upsert(prospect_payload).execute()
        print(f"Synced Prospect: {key}")

        histories = issue.get("changelog", {}).get("histories", [])
        for history in histories:
            created_date = history["created"]
            for item in history.get("items", []):
                if item.get("field") == "status":
                    transition_payload = {
                        "issue_key": key,
                        "from_status": item.get("fromString", "Created"),
                        "to_status": item.get("toString", ""),
                        "transitioned_at": created_date
                    }
                    supabase.table("nmmsb_transitions").upsert(
                        transition_payload, 
                        ignore_duplicates=True,
                        on_conflict="issue_key,to_status,transitioned_at"
                    ).execute()
                    
    print("Database sync complete.")

if __name__ == "__main__":
    fetch_and_sync()