CREATE TABLE IF NOT EXISTS comments (
 id CHAR(36) PRIMARY KEY, content_id CHAR(36) NOT NULL, parent_id CHAR(36) NULL,
 author_name VARCHAR(40) NOT NULL, body TEXT NOT NULL, is_author BOOLEAN NOT NULL DEFAULT FALSE,
 status VARCHAR(12) NOT NULL DEFAULT 'pending', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX(content_id,status,parent_id,created_at), INDEX(status,created_at),
 FOREIGN KEY(content_id) REFERENCES content_items(id) ON DELETE CASCADE,
 FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS comment_attempts (
 ip_hash CHAR(64) PRIMARY KEY, attempts INT NOT NULL DEFAULT 0, window_started DATETIME NOT NULL
) ENGINE=InnoDB;
