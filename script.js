function validateForm() {

    var name = document.getElementById("name").value;
    var email = document.getElementById("email").value;
    var phone = document.getElementById("phone").value;
    var course = document.getElementById("course").value;
    var address = document.getElementById("address").value;

    var message = document.getElementById("formMessage");

    if (name.length < 3) {
        alert("Enter a valid name (minimum 3 characters).");
        return false;
    }

    if (email.length < 5 || email.indexOf("@") == -1) {
        alert("Enter a valid email address.");
        return false;
    }

    var phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(phone)) {
        alert("Enter a valid 10-digit phone number.");
        return false;
    }

    if (course == "") {
        alert("Please select a course.");
        return false;
    }

    if (address.length < 10) {
        alert("Enter a valid address.");
        return false;
    }

    message.innerHTML = "Form is being submitted...";
    return true;
}
