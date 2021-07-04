<?php

if (isset($_POST['submit'])) {
	$name = $_POST['name'];
	$subject = $_POST['subject'];
	$mailFrom = $_POST['mail'];
  $tel = $_POST['telephone'];
	$message = $_POST['message'];

	$mailTo = "contact@intsight.net";
	$header = "From: ".$mailFrom;
	$txt = "You have received an email from ".$name." ".$tel.".\n\n".$message;

	mail($mailTo, $subject, $txt, $header);

  // echo "<script type='text/javascript'>alert('ขอบคุณสำหรับความสนใจ เราจะรีบติดต่อกลับไป!')</script>";

	header("Location: index.html?mailsend");
}
 ?>
