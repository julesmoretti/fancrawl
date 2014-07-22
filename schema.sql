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
-- Table 's_followed_by'
-- Original followed_by list
-- ---

DROP TABLE IF EXISTS `s_followed_by`;

CREATE TABLE `s_followed_by` (
  `id` INTEGER NULL AUTO_INCREMENT DEFAULT NULL,
  `inst_id` INTEGER(10) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) COMMENT 'Original followed_by list';

-- ---
-- Table 's_followers'
-- original followers
-- ---

DROP TABLE IF EXISTS `s_followers`;

CREATE TABLE `s_followers` (
  `id` INTEGER NULL AUTO_INCREMENT DEFAULT NULL,
  `inst_id` INTEGER(10) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) COMMENT 'original followers';

-- ---
-- Table 'beta_followers'
-- Attempted followers
-- ---

DROP TABLE IF EXISTS `beta_followers`;

CREATE TABLE `beta_followers` (
  `id` INTEGER NULL AUTO_INCREMENT DEFAULT NULL,
  `inst_id` INT NULL DEFAULT NULL,
  `count` INTEGER(9) NULL DEFAULT 0,
  `hooked` INTEGER(1) NULL DEFAULT 0,
  `creation_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `refresh_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) COMMENT 'Attempted followers';

-- ---
-- Foreign Keys
-- ---


-- ---
-- Table Properties
-- ---

ALTER TABLE `s_followed_by` ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
ALTER TABLE `s_followers` ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
ALTER TABLE `beta_followers` ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- ---
-- Test Data
-- ---

INSERT INTO `s_followed_by` (`inst_id`) VALUES
('1234567');
INSERT INTO `s_followed_by` (`inst_id`) VALUES
('234567');
INSERT INTO `s_followed_by` (`inst_id`) VALUES
('34567');

INSERT INTO `s_followers` (`inst_id`) VALUES
('1234557');
INSERT INTO `s_followers` (`inst_id`) VALUES
('234557');
INSERT INTO `s_followers` (`inst_id`) VALUES
('34557');

INSERT INTO `beta_followers` (`inst_id`) VALUES
('1234567');
INSERT INTO `beta_followers` (`inst_id`) VALUES
('234567');
INSERT INTO `beta_followers` (`inst_id`) VALUES
('34567');

-- Cheat sheet

-- show databases;
-- show tables;

-- drop database fancrawl;

-- use fancrawl;

-- drop table s_followed_by;

-- describe s_followed_by;
-- describe s_followers;
-- describe beta_followers;

-- select * from s_followed_by;
-- select * from s_followers;
-- select * from beta_followers;

-- update beta_followers set hooked = 1 where id = 2;
-- update beta_followers set refresh_date = now() where id = 2;

-- delete from beta_followers;
-- delete from beta_followers where hooked = 1;
