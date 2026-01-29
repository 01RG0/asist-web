-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: attendance_system
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assistants_centers`
--

DROP TABLE IF EXISTS `assistants_centers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assistants_centers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assistant_id` int NOT NULL,
  `center_id` int NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_assignment` (`assistant_id`,`center_id`),
  KEY `idx_assistant` (`assistant_id`),
  KEY `idx_center` (`center_id`),
  CONSTRAINT `assistants_centers_ibfk_1` FOREIGN KEY (`assistant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `assistants_centers_ibfk_2` FOREIGN KEY (`center_id`) REFERENCES `centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assistants_centers`
--

LOCK TABLES `assistants_centers` WRITE;
/*!40000 ALTER TABLE `assistants_centers` DISABLE KEYS */;
/*!40000 ALTER TABLE `assistants_centers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assistant_id` int NOT NULL,
  `session_id` int NOT NULL,
  `center_id` int NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `time_recorded` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delay_minutes` int NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance` (`assistant_id`,`session_id`),
  KEY `idx_session` (`session_id`),
  KEY `idx_assistant` (`assistant_id`),
  KEY `idx_center` (`center_id`),
  KEY `idx_time_recorded` (`time_recorded`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`assistant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_3` FOREIGN KEY (`center_id`) REFERENCES `centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (3,3,9,19,31.2536895,29.9781076,'2025-11-23 18:30:08',110,'2025-11-23 18:30:08');
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES (1,2,'CREATE_USER','{\"name\": \"dad\", \"role\": \"assistant\", \"email\": \"randomgamerx999@gmail.com\", \"user_id\": 7}','2025-11-23 19:25:06');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `centers`
--

DROP TABLE IF EXISTS `centers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `centers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `radius_m` int NOT NULL DEFAULT '30',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `centers`
--

LOCK TABLES `centers` WRITE;
/*!40000 ALTER TABLE `centers` DISABLE KEYS */;
INSERT INTO `centers` VALUES (19,'high star',31.2536342,29.9778217,30,NULL,'2025-11-23 16:39:11'),(20,'ahmed',31.2535792,29.9763626,30,NULL,'2025-11-23 18:06:48');
/*!40000 ALTER TABLE `centers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `assistant_id` int DEFAULT NULL,
  `center_id` int NOT NULL,
  `subject` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recurrence_type` enum('one_time','weekly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'one_time',
  `day_of_week` tinyint DEFAULT NULL COMMENT '1=Monday, 7=Sunday',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `start_time` datetime NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assistant_date` (`assistant_id`),
  KEY `idx_center_date` (`center_id`),
  KEY `idx_recurrence` (`recurrence_type`,`is_active`),
  KEY `idx_day_of_week` (`day_of_week`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`assistant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sessions_ibfk_2` FOREIGN KEY (`center_id`) REFERENCES `centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES (9,3,19,'math','one_time',NULL,1,'2025-11-23 16:40:00','2025-11-23 16:40:47');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','assistant') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'assistant',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'System Admin','admin@example.com','$2a$10$YGZ5qp5qZ5qZ5qZ5qZ5qZeK5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ5qZ','admin','2025-11-21 06:05:06'),(2,'System Administrator','admin@attendance.com','$2a$10$d2dr9IyUrdcna5hWufOvQOF8zowONltPKe1zHI1lRHqiXHMJH06zG','admin','2025-11-21 06:05:21'),(3,'Ahmed Hassan','assistant1@attendance.com','$2a$10$D3GjkV5GpQMc0DUVOVyR4OTxowB6FmZo1bQQKT.feKZM9TSj.WmVG','assistant','2025-11-21 06:05:21'),(4,'Sara Mohamed','assistant2@attendance.com','$2a$10$D3GjkV5GpQMc0DUVOVyR4OTxowB6FmZo1bQQKT.feKZM9TSj.WmVG','assistant','2025-11-21 06:05:21'),(5,'Omar Ali','assistant3@attendance.com','$2a$10$D3GjkV5GpQMc0DUVOVyR4OTxowB6FmZo1bQQKT.feKZM9TSj.WmVG','assistant','2025-11-21 06:05:21'),(7,'dad','randomgamerx999@gmail.com','$2a$10$ngqIClL7Kv7kvnSddNbWnubz1UWn5rZmlv4/UI8n5uzxu.vil3dle','assistant','2025-11-23 21:25:06');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-23 21:46:09
