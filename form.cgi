# form.cgi
# Written by: Chris Pratt
# Purpose: This is a proof of concept of querying through the database by distinct fields

#!/usr/bin/perl -T

use strict;
use warnings;

use CGI;
use DBI;
use HTML::Template;

# Associate the Template with the CGI File
my $cgi = CGI->new;
my $template = HTML::Template->new(filename => 'form.tmpl', associate=>$cgi);

print "Content-type: text/html\n\n";
print $template->output;

# Connection to our database 
my $connection = DBI->connect('DBI:mysql:KratylosDB:localhost','kratylos','CATS');

# Function used to query the database based on parameters in the template file
sub query_submit{
	# Retrieve values from parameters in the template
	my $text = '%' . $cgi->param("language") . '%';
	my $selection = $cgi->param("column");
	# If we're not querying the table 'tags', query from the 'projects' table
	if ($selection ne 'tags'){
		my $string = "select * from projects where " . $selection . " like '" . $text . "'";
		# Retrieve data using MySQL call
		my $query = $connection->prepare($string);
		$query->execute();
		# Initialize a table to wrap information
		print("<font size='2' face='Courier New'>");
		print("<table style='width:100%'>");
		print("<tr>");
		print("<th>Language</th>");
		print("<th>Language Code</th>");
		print("<th>Version</th>");
		print("<th>Data Type</th>");
		print("<th>Provenance</th>");
		print("<th>Date Uploaded</th>");
		print("</tr>");
		# Dynamically create rows based on amount of information
		while(my @row = $query->fetchrow_array()){
			print("<tr>");
			printf("<th>%s</th>",$row[1]);
			printf("<th>%s</th>",$row[2]);
			printf("<th>%s</th>",$row[3]);
			printf("<th>%s</th>",$row[5]);
			printf("<th>%s</th>",$row[6]);
			printf("<th>%s</th>",$row[10]);
			print("</tr>");
		}
		$query->finish();
		print("</table></font>");
	}
	else {	
		# Same as above but reformatted for the 'tags' table
		my $string = "select * from tagss where " . $selection . " like '" . $text . "'";
		my $query = $connection->prepare($string);
		$query->execute();
		print("<font size='2' face='Courier New'>");
		print("<table style='width:100%'>");
		print("<tr>");
		print("<th>Project ID</th>");
		print("<th>Tags</th>");
		print("</tr>");
		while(my @row = $query->fetchrow_array()){
			print("<tr>");
			printf("<th>%s</th>",$row[0]);
			printf("<th>%s</th>",$row[1]);
			print("</tr>");
		}
		$query->finish();
		print("</table></font>");
	}
}
# If the button 'doSubmit' is pressed on the template, call the function
if ($cgi->param("doSubmit")){
	query_submit();
}
