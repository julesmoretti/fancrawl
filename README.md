sudo mysql < schema.sql
sudo mysql < schema_data.sql  


/* You can also create more tables, if you need them... */

/*  Execute this file from the command line by typing:
 *    mysql -u root < schema.sql
 *  to create the database and the tables.
 *  then to get into the sql database
 *    sudo mysql
 *  look at cheat sheet bellow
 * */



alter table access_right modify state varchar(255) default "stopped";
alter table beta_followers modify column count int(9) default '1';
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

on server side fresh mysql use

```
aptitude install mysql-server mysql-client
```

to check if it is running

```
service mysql status
```

Check with admin status

```
mysqladmin -u root -p status
```

to login

```
mysql -u root -p
```


local machine sql password reset
```
mysql --user=root mysql

update user set Password=PASSWORD('new-password') where user='root';
flush privileges;
exit;
```

in server side use 
```
mysql --user=root -p
mysql --user=root -p < schema.sql
```

followed this tutorial to update mysql to 5.6

http://xmodulo.com/2013/12/upgrade-mysql-server-debian-ubuntu.html


ADDED local variable local in order to control sass bug...

pm2 command to start server `pm2 start server.js --name fancrawl -i max --watch`

to set mysql timezone
```
SET GLOBAL time_zone = '-7:00';
SET time_zone = "-7:00";
```

