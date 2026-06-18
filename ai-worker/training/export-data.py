#!/usr/bin/env python3
"""Export training data from the database for inspection."""
import os, csv, sys
import psycopg2

DB_URL = os.getenv("DATABASE_URL", "postgresql://jalfaiat:Eelflpbqjv2003!@192.168.1.49:5432/blindtest")

def export(filename="training-data.csv"):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT ON (t.id)
            t.name, t.artist_name,
            COALESCE(cu.genre_id, c.genre_id) as genre,
            c.confidence, c.source as classification_source,
            COALESCE(cu.verified, FALSE) as curated
        FROM tracks t
        JOIN classifications c ON c.track_id = t.id
        LEFT JOIN curation cu ON cu.track_id = t.id
        WHERE COALESCE(cu.genre_id, c.genre_id) NOT IN ('UNCLASSIFIED', 'GL_other')
          AND c.confidence >= 0.5
        ORDER BY t.id, c.created_at DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['name', 'artist', 'genre', 'confidence', 'source', 'curated'])
        w.writerows(rows)

    print(f"Exported {len(rows)} training examples to {filename}")

    # Count per genre
    from collections import Counter
    counts = Counter(r[2] for r in rows)
    print(f"\n{len(counts)} genres:")
    for genre, count in counts.most_common():
        print(f"  {genre}: {count}")

if __name__ == "__main__":
    export(sys.argv[1] if len(sys.argv) > 1 else "training-data.csv")
