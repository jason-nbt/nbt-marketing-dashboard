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
    url = f"https://{JIRA_DOMAIN}/rest/api/3/search"
    auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN)
    headers = {"Accept": "application/json"}
    
    jql = 'project = "NMMSB" ORDER BY created DESC'
    params = {
        "jql": jql,
        "expand": "changelog",
        "maxResults": 100
    }

    response = requests.get(url, headers=headers, params=params, auth=auth)
    response.raise_for_status()
    issues = response.json().get("issues", [])

    for issue in issues:
        key = issue["key"]
        fields = issue["fields"]
        
        # Upsert prospect snapshot
        prospect_payload = {
            "issue_key": key,
            "summary": fields.get("summary", ""),
            "assignee": fields.get("assignee", {}).get("displayName", "Unassigned") if fields.get("assignee") else "Unassigned",
            "current_status": fields.get("status", {}).get("name", ""),
            "created_at": fields.get("created")
        }
        supabase.table("nmmsb_prospects").upsert(prospect_payload).execute()

        # Parse history items for status changes
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
                        transition_payload, ignore_duplicates=True
                    ).execute()

if __name__ == "__main__":
    fetch_and_sync()