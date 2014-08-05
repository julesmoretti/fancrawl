sudo mysql < schema.sql
sudo mysql < schema_data.sql  

created my.cnf into /usr/local/etc/ to solve for utf8mb4 characters

```
[client]
default-character-set = utf8mb4

[mysql]
default-character-set = utf8mb4

[mysqld]
character-set-client-handshake = FALSE
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```