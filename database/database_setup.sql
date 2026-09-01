-- Main prospects table
CREATE TABLE IF NOT EXISTS nmmsb_prospects (
    issue_key VARCHAR PRIMARY KEY,
    summary TEXT NOT NULL,
    assignee VARCHAR DEFAULT 'Unassigned',
    current_status VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow movement log table
CREATE TABLE IF NOT EXISTS nmmsb_transitions (
    id BIGSERIAL PRIMARY KEY,
    issue_key VARCHAR REFERENCES nmmsb_prospects(issue_key) ON DELETE CASCADE,
    from_status VARCHAR NOT NULL,
    to_status VARCHAR NOT NULL,
    transitioned_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT unique_transition UNIQUE(issue_key, to_status, transitioned_at)
);

-- Indexing for fast dynamic period queries
CREATE INDEX IF NOT EXISTS idx_transitions_date ON nmmsb_transitions(transitioned_at);
CREATE INDEX IF NOT EXISTS idx_transitions_status ON nmmsb_transitions(to_status);