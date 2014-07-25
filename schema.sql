DROP DATABASE IF EXISTS `fancrawl`;

CREATE DATABASE `fancrawl`;

USE fancrawl;


/* You can also create more tables, if you need them... */

/*  Execute this file from the command line by typing:
 *    mysql -u root < schema.sql
 *  to create the database and the tables.
 *  then to get into the sql database
 *    sudo mysql
 *  look at cheat sheet bellow
 * */


-- ---
-- Globals
-- ---

-- SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
-- SET FOREIGN_KEY_CHECKS=0;

-- ---
-- Table 'access_right'
-- Original access_right list
-- ---

DROP TABLE IF EXISTS `access_right`;

CREATE TABLE `access_right` (
  `id` INT NULL AUTO_INCREMENT DEFAULT NULL,
  `state` VARCHAR(15) NULL DEFAULT 'fresh',
  `fname` VARCHAR(15) NULL DEFAULT NULL,
  `iname` VARCHAR(15) NULL DEFAULT NULL,
  `iid` INT NULL DEFAULT NULL,
  `code` VARCHAR(32) NULL DEFAULT NULL,
  `token` VARCHAR(60) NULL DEFAULT NULL,
  `pp` VARCHAR(100) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) COMMENT 'Original access_right list';

-- ---
-- Table 's_followed_by'
-- Original followed_by list
-- ---

DROP TABLE IF EXISTS `s_followed_by`;

CREATE TABLE `s_followed_by` (
  `id` INT NULL AUTO_INCREMENT DEFAULT NULL,
  `iid` INT NULL DEFAULT NULL,
  `fname` VARCHAR(15) NULL DEFAULT NULL,
  `iname` VARCHAR(15) NULL DEFAULT NULL,
  `fbid` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) COMMENT 'Original followed_by list';

-- ---
-- Table 's_followers'
-- original followers
-- ---

DROP TABLE IF EXISTS `s_followers`;

CREATE TABLE `s_followers` (
  `id` INT NULL AUTO_INCREMENT DEFAULT NULL,
  `iid` INT NULL DEFAULT NULL,
  `fname` VARCHAR(15) NULL DEFAULT NULL,
  `iname` VARCHAR(15) NULL DEFAULT NULL,
  `fid` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) COMMENT 'original followers';

-- ---
-- Table 'beta_followers'
-- Attempted followers
-- ---

DROP TABLE IF EXISTS `beta_followers`;

CREATE TABLE `beta_followers` (
  `id` INT NULL AUTO_INCREMENT DEFAULT NULL,
  `iid` INT NULL DEFAULT NULL,
  `nid` INT NULL DEFAULT NULL,
  `c` INT(9) NULL DEFAULT 0,
  `f` INT(1) NULL DEFAULT 0,
  `cd` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `rd` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) COMMENT 'Attempted followers';

-- ---
-- Foreign Keys
-- ---

-- iname = Instagram userName
-- iid = Current Users Instagram ID
-- fbid = followed_by ID
-- fid = followers ID
-- nid = New Targeted Instagram ID
-- c = count of following test
-- f = if nid is now following iid or not
-- cd = creation date
-- rd = refresh date
-- state = fresh (never started), started (initiated the crawl), stopping (cleaning up directory back to original), stopped (finished removing test followers)

-- ---
-- Table Properties
-- ---

ALTER TABLE `access_right` ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
ALTER TABLE `s_followed_by` ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
ALTER TABLE `s_followers` ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
ALTER TABLE `beta_followers` ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;