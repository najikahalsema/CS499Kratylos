#This was a test file to test our abilities to actually make database calls through a simple connection
use DBI;
#simple connection
$myConnection = DBI->connect('DBI:mysql:KratylosDB:localhost', 'kratylos','CATS');
#$query = $myConnection->prepare('SELECT VERSION()');
#$result = $query->execute();
#my $pid = $query->fetch();
#print @$pid;
#$query->finish();
printf("This is what Finkel is doing\n");
query_projectsFinkel($myConnection);
printf("This is what we need to do\n");
query_projectsUs($myConnection);
#query the projects table to produce all of the language codes

sub query_projectsUs{
	my ($myConnection) = @_;
	#my $sql = "SELECT * FROM projects where langCode = 'aramaic'";
	my $sql = "SELECT DISTINCT P.language, P.version FROM (SELECT * FROM projects) AS P, (SELECT * FROM projects) AS P1 WHERE P.langCode = P1.langCode";
	my $call = $myConnection->prepare($sql);

	#execute the query
	$call->execute();
	#printf("aramaic\n");
	$prev = 'that';
	while(my @row = $call->fetchrow_array()){
		if ($prev != $row[0]){
			printf("%s\n",$row[0]);
		}
		printf("\t%s\n", $row[1]);
		printf("prev is: %s\n", $prev);
		$prev = $row[0];
	}
	$call->finish();
}
sub query_projectsFinkel{
	my ($myConnection) = @_;
	my $sql = "SELECT * FROM projects where language = 'aramaic'";
	my $sth = $myConnection->prepare($sql);

	$sth->execute();
	while(my @row = $sth->fetchrow_array()){
		printf("%s\n\t%s\n",$row[2],$row[3]);
	}
	$sth->finish();
}

