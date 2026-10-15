#!/usr/bin/env python3
"""
tools/reports.py — Daily Git Log Summary & Disclosure Report Generator.

This tool extracts git commit logs, groups them by day, summarizes changes,
and writes structured daily markdown disclosure reports to docs/reports/REPORT_{date}.md.
"""

import argparse
import datetime
import os
import re
import subprocess
import sys
from collections import defaultdict
from typing import Dict, List, Optional, Tuple


def run_git_cmd(args: List[str], cwd: Optional[str] = None) -> str:
    """Execute a git command and return stripped stdout."""
    res = subprocess.run(
        ["git"] + args,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    return res.stdout.strip()


class Commit:
    def __init__(self, commit_hash: str, author_date_iso: str, author_name: str, subject: str, body: str = ""):
        self.hash = commit_hash
        self.short_hash = commit_hash[:7] if len(commit_hash) >= 7 else commit_hash
        self.date_iso = author_date_iso
        self.date_str = author_date_iso.split()[0]  # YYYY-MM-DD
        self.time_str = author_date_iso.split()[1] if len(author_date_iso.split()) > 1 else ""
        self.author = author_name
        self.subject = subject.strip()
        self.body = body.strip()

        # Categorization based on Conventional Commits or keywords
        self.category, self.scope = self._parse_category(self.subject)

    @staticmethod
    def _parse_category(subject: str) -> Tuple[str, str]:
        match = re.match(r"^(\w+)(?:\(([^)]+)\))?!?: (.+)$", subject)
        if match:
            ctype, scope, _ = match.groups()
            ctype = ctype.lower()
            scope = scope or ""
            return ctype, scope
        return "other", ""


def fetch_commits(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    since_commit: Optional[str] = None,
    current_month: bool = False,
    branch: str = "HEAD",
) -> List[Commit]:
    """Fetch commits using git log according to filter parameters."""
    git_args = [
        "log",
        branch,
        "--date=iso",
        "--format=COMMIT_DELIM%n%H%n%ad%n%an%n%s%n%b",
    ]

    today = datetime.date.today()

    if since_commit:
        git_args.append(f"{since_commit}..{branch}")
    else:
        if current_month:
            first_of_month = today.replace(day=1)
            git_args.append(f"--since={first_of_month.isoformat()} 00:00:00")
        elif start_date:
            git_args.append(f"--since={start_date} 00:00:00")

        if end_date:
            git_args.append(f"--until={end_date} 23:59:59")

    try:
        raw_output = run_git_cmd(git_args)
    except subprocess.CalledProcessError as e:
        sys.stderr.write(f"Git command failed: {e.stderr}\n")
        return []

    if not raw_output:
        return []

    raw_blocks = raw_output.split("COMMIT_DELIM\n")
    commits: List[Commit] = []

    for block in raw_blocks:
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n", 4)
        if len(lines) >= 4:
            c_hash = lines[0].strip()
            c_date = lines[1].strip()
            c_author = lines[2].strip()
            c_subject = lines[3].strip()
            c_body = lines[4].strip() if len(lines) > 4 else ""
            commits.append(Commit(c_hash, c_date, c_author, c_subject, c_body))

    return commits


def group_commits_by_day(commits: List[Commit]) -> Dict[str, List[Commit]]:
    """Group commits into dictionary keyed by 'YYYY-MM-DD'."""
    grouped = defaultdict(list)
    for c in commits:
        grouped[c.date_str].append(c)
    return grouped


def generate_day_summary(commits: List[Commit]) -> str:
    """Generate an overview summary for the start of a daily report."""
    categories: Dict[str, int] = defaultdict(int)
    authors = set()
    for c in commits:
        categories[c.category] += 1
        authors.add(c.author)

    total = len(commits)
    cat_summary = ", ".join([f"{count} {cat}" for cat, count in sorted(categories.items())])
    author_str = ", ".join(sorted(authors))

    summary = (
        f"A total of {total} commit(s) by {author_str}. "
        f"Breakdown: {cat_summary}."
    )
    return summary


def render_report_markdown(date_str: str, commits: List[Commit]) -> str:
    """Render markdown for a single day report (REPORT_{date}.md)."""
    # Sort commits chronologically within the day
    commits_sorted = sorted(commits, key=lambda c: c.date_iso)
    summary_text = generate_day_summary(commits_sorted)

    # Group by category for structured breakdown
    cat_order = ["feat", "fix", "docs", "refactor", "perf", "test", "chore", "release", "other"]
    by_cat: Dict[str, List[Commit]] = defaultdict(list)
    for c in commits_sorted:
        by_cat[c.category].append(c)

    md = []
    md.append(f"# Daily Disclosure Report — {date_str}")
    md.append("")
    md.append("## Daily Summary")
    md.append(f"> **Overview**: {summary_text}")
    md.append("")
    md.append("### Key Highlights")
    for c in commits_sorted:
        scope_prefix = f"**[{c.scope}]** " if c.scope else ""
        md.append(f"- {scope_prefix}{c.subject} (`{c.short_hash}` by {c.author})")
    md.append("")

    md.append("## Changes by Category")
    for cat in cat_order:
        if cat in by_cat:
            cat_title = cat.capitalize() if cat != "other" else "Other Changes"
            md.append(f"### {cat_title} ({len(by_cat[cat])})")
            for c in by_cat[cat]:
                md.append(f"- [`{c.short_hash}`] **{c.subject}**")
                if c.body:
                    body_lines = [f"  > {line}" for line in c.body.split("\n") if line.strip()]
                    if body_lines:
                        md.append("\n".join(body_lines[:3]))  # limit excerpt
            md.append("")

    remaining_cats = [cat for cat in by_cat if cat not in cat_order]
    for cat in sorted(remaining_cats):
        md.append(f"### {cat.capitalize()} ({len(by_cat[cat])})")
        for c in by_cat[cat]:
            md.append(f"- [`{c.short_hash}`] **{c.subject}**")
        md.append("")

    md.append("## Commit Chronology")
    md.append("| Time | Hash | Author | Subject |")
    md.append("|---|---|---|---|")
    for c in commits_sorted:
        clean_subj = c.subject.replace("|", "\\|")
        md.append(f"| {c.time_str} | `{c.short_hash}` | {c.author} | {clean_subj} |")
    md.append("")

    return "\n".join(md).strip() + "\n"


def write_reports(
    grouped_commits: Dict[str, List[Commit]],
    output_dir: str = "docs/reports",
    overwrite: bool = True,
    dry_run: bool = False,
) -> List[str]:
    """Write REPORT_{date}.md for each date in grouped_commits."""
    os.makedirs(output_dir, exist_ok=True)
    created_files = []

    for date_str, commits in sorted(grouped_commits.items()):
        file_name = f"REPORT_{date_str}.md"
        file_path = os.path.join(output_dir, file_name)

        if os.path.exists(file_path) and not overwrite:
            print(f"[SKIP] {file_path} exists and overwrite=False")
            continue

        content = render_report_markdown(date_str, commits)

        if dry_run:
            print(f"[DRY-RUN] Would write {len(content)} bytes to {file_path}")
        else:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[CREATED] {file_path} ({len(commits)} commits)")
        created_files.append(file_path)

    return created_files


def main():
    parser = argparse.ArgumentParser(
        description="Extract git log changes daily and write disclosure reports."
    )
    parser.add_argument(
        "--current-month",
        action="store_true",
        help="Summarize all commits in the current calendar month.",
    )
    parser.add_argument(
        "--start-date",
        type=str,
        default=None,
        help="Start date in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--end-date",
        type=str,
        default=None,
        help="End date in YYYY-MM-DD format (defaults to today).",
    )
    parser.add_argument(
        "--since-commit",
        type=str,
        default=None,
        help="Commit hash or tag to start from (e.g. HEAD~20 or 142a115).",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="docs/reports",
        help="Target folder for reports (default: docs/reports).",
    )
    parser.add_argument(
        "--branch",
        type=str,
        default="HEAD",
        help="Git branch or ref to inspect (default: HEAD).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Output plan without writing report files.",
    )
    parser.add_argument(
        "--no-overwrite",
        action="store_true",
        help="Do not overwrite existing report files.",
    )

    args = parser.parse_args()

    # Default to current month if no filter specified
    if not args.current_month and not args.start_date and not args.since_commit:
        args.current_month = True

    commits = fetch_commits(
        start_date=args.start_date,
        end_date=args.end_date,
        since_commit=args.since_commit,
        current_month=args.current_month,
        branch=args.branch,
    )

    if not commits:
        print("No commits found matching the specified timeframe/criteria.")
        sys.exit(0)

    grouped = group_commits_by_day(commits)
    print(f"Discovered {len(commits)} commit(s) spanning {len(grouped)} day(s).")

    created = write_reports(
        grouped_commits=grouped,
        output_dir=args.output_dir,
        overwrite=not args.no_overwrite,
        dry_run=args.dry_run,
    )

    print(f"Successfully processed {len(created)} daily report(s).")


if __name__ == "__main__":
    main()
