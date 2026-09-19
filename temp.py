import sqlite3
from models import normalize_text  # 或从 utils 导入
from models import Session, Video
from sqlalchemy import text

DB_PATH = "videos.db"  # 换成你实际的 sqlite 文件路径

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. 查看现有列，避免重复添加
    cur.execute("PRAGMA table_info(videos)")
    cols = [row[1] for row in cur.fetchall()]
    if 'filename_norm' not in cols:
        cur.execute("ALTER TABLE videos ADD COLUMN filename_norm VARCHAR")
        print("added column filename_norm")
    else:
        print("column already exists")

    # 2. 建索引
    cur.execute("CREATE INDEX IF NOT EXISTS ix_videos_filename_norm ON videos(filename_norm)")
    conn.commit()
    conn.close()

    # 3. 回填存量数据
    session = Session()
    try:
        videos = session.query(Video).all()
        for v in videos:
            v.filename_norm = normalize_text(v.filename)
        session.commit()
        print(f"backfilled {len(videos)} rows")
    finally:
        session.close()

if __name__ == '__main__':
    migrate()