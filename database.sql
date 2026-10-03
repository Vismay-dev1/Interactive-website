CREATE DATABASE college_db;

USE college_db;

CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    course VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL
);
