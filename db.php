<?php

$conn = mysqli_connect("localhost", "root", "", "college_db");

if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

?>
