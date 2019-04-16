#!/usr/bin/perl -T
=head1 SYNOPSYS
filename:     project.cgi
author: re-written by Jiho Noh (jiho.noh@uky.edu) 01/2017

Read/modify project information depending on the users role of the project

- Version 10/2018
- Version 4/2019 
Najika Halsema: Adding comments, cleaning things up to allow for more precise
DB search
	must allow selecting multiple projects before search

=cut

use strict;
use warnings FATAL => 'all';

use CGI qw/-utf8/;
use CGI::Session;
use HTML::Template;
use Log::Log4perl;

use lib ('src/perllib');
use Common;
use KratylosDB;

use Data::Dumper;  # remove this when completed

# Variables
my ($isSessValid, %user, %project, $kratDB, $viewMode, $errmsg);
my $cgi = CGI->new();
my $pid = $cgi->param('pid');
my $logger = Log::Log4perl->get_logger();
my $debug = 0;

# init:
#   1) check session cookie,
#   2) get user and project information
#   3) set mode and corresponding template
sub init {
	binmode STDIN, ":utf8";
	binmode STDOUT, ":utf8";
	binmode STDERR, ":utf8";

	$kratDB = KratylosDB->new();

	# session
	my $sess = CGI::Session->load();
	$isSessValid = (!$sess || $sess->is_expired || $sess->is_empty) ? 0 : 1;

	# user
	if ($isSessValid) {
		%user = %{$kratDB->readUserProfile(CGI::cookie('USER'))};
	} else {
		$user{'email'} = 'friend';
		$user{'group'} = 'friend';
		$user{'role'} = 'anonymous';
	}

	# $pid = '451'; # debugging
	# determine view mode
	if ($isSessValid) {
		if (defined $pid) {
			# read the project
			# get user role in the project
			# $logger->debug("($0) session valid, pid defined as $pid");
			$user{'role'} = $kratDB->user_role_project(
				$user{'uid'}, $pid);
			# $logger->debug("($0) user role: $user{'role'}");
		} else {
			$logger->debug("($0) session valid, no pid");
			$user{'role'} = 'anonymous';
		}
		if ($user{'group'} eq 'admin') {
			$viewMode = 'admin';
		} else {
			if ($user{'role'} eq 'maintainer' or
				$user{'role'} eq 'collaborator') {
				$viewMode = 'member';
			} else {
				$viewMode = 'noControl';
			}
		}
	} else {
		if (defined $pid) {
			$logger->debug("($0) session invalid, pid $pid");
			if (1) {  # is the project public accessible?
				$viewMode = 'anonymous';
			} else {
				$viewMode = 'inaccessible';
				$errmsg = "The project is not publicly accessible. " .
					"[pid: $pid]";
			}
		} else {
			$logger->debug("($0) session invalid, no pid");
			$viewMode = 'inaccessible';  # missing
			$errmsg = "You can log in to view your projects or select a
			publicly available project from the list below.";
		}
	} # session invalid
} # init()

sub buildPage {
	my $template = HTML::Template->new(utf8 => 1, die_on_bad_params => 0,
		filename => 'src/tmpl/499.tmpl');

	# Set template parameters (common)
	$template->param('loggedin' => $isSessValid);
	$template->param('user' => $user{'email'});
	$template->param('user_role' => $user{'role'});
	$template->param('isAdmin' => 1) if $user{'group'} eq 'admin';
	if (defined $pid) {
		# In 499.tmpl, setting 'project.pid' to be whatever $pid is
		$template->param('project.pid' => $pid);
		$template->param('display.project_detail' => 1);
	}
	my $host = getHost();
	$template->param('host-domain' => $host->{'domain'});
	$template->param('host-version' => $host->{'version'});
	if ($host->{'version'} ne "Version L") {  # Exclude the production stream
		$template->param(host_ver => $host->{'version'});
	}

	# Set template parameters (by viewMode)
	my ($showMine, $showPublic, $control, $maintain, $admin);
	if (defined($pid)) {  # no projects to list at all
		$showMine = 0;
		$showPublic = 0;
	}
	if ($viewMode eq 'anonymous') {  # anonymous
		$showMine //= 1;
	} elsif ($viewMode eq 'inaccessible') {  # not found or not public
		$showMine //= 1;
	} elsif ($viewMode eq 'admin') {  # admin
		$showMine //= 1;
		$control = 1;
		$maintain = 1;
		$admin = 1;
	} elsif ($viewMode eq 'noControl') { # no-control view
		$showMine //= 1;
	} elsif ($viewMode eq 'member') { # project member view
		$showMine //= 1;
		$control = 1;
		if ($user{'role'} eq 'maintainer') {
			$maintain = 1;
		}
	} else {
		die("internal error: invalid viewMode\n");
	}
	$template->param('display.myProjects' => $showMine);
	$template->param('display.publicProjects' => $showPublic);
	$template->param('display.control' => $control);
	$template->param('display.control_maintainer' => $maintain);
	$template->param('display.control_admin' => $admin);
	if (defined $errmsg) {
		$template->param('errmsg' => $errmsg);
	}

	# Load static components
	my %staticViews = (
		mainBanner => 'src/tmpl/mainBanner.html',
		authModals => 'src/tmpl/authModals.html'
	);
	readStaticViews($template, \%staticViews);
	# Print out
	if ($debug) {
		open DEBUG, ">/tmp/kratDebug.html" or die("Cannot write debug file\n");
		binmode DEBUG, ":utf8";
		print DEBUG $template->output;
		$logger->debug("($0) see /tmp/kratDebug.html");
		close DEBUG;
	}
	print "Content-Type: text/html; charset=utf-8\n\n", $template->output;
} # buildPage()

init();
buildPage();
