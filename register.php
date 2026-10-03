<?php

include "db.php";

$name = mysqli_real_escape_string($conn, $_POST["name"]);
$email = mysqli_real_escape_string($conn, $_POST["email"]);
$phone = mysqli_real_escape_string($conn, $_POST["phone"]);
$gender = mysqli_real_escape_string($conn, $_POST["gender"]);
$course = mysqli_real_escape_string($conn, $_POST["course"]);
$address = mysqli_real_escape_string($conn, $_POST["address"]);

$sql = "INSERT INTO students
(name, email, phone, gender, course, address)
VALUES
('$name', '$email', '$phone', '$gender', '$course', '$address')";

if (mysqli_query($conn, $sql)) {
    echo "Registration Successful";
} else {
    echo "Registration Failed: " . mysqli_error($conn);
}

?>
