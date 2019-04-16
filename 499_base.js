/*jshint globalstrict: true*/
/*jshint browser: true*/
/*jshint devel: true*/
/*global alertify*/
"use strict";
var s, p, us, prj, dp;
	// s: pointer to auth.stat,
	// p: pointer to profile.settings
	// us: dataUpload.settings
	// prj: project.settings
	// dp: display.settings

const utils = {
	getCookie: function(name) {
		let q = name + "=";
		let c = document.cookie;
		let e = c.indexOf(q);
		if (e === -1) {
			return "";
		}
		let g = c.indexOf(";", e + q.length);
		if (g === -1) {
			g = c.length;
		}
		//return unescape(c.substring(e + q.length, g));
		return decodeURIComponent(c.substring(e + q.length, g));
	},
	humanFileSize: function(bytes, si) {
		const thresh = si ? 1000 : 1024;
		if(Math.abs(bytes) < thresh) {
			return bytes + ' B';
		}
		const units = si ? ['kB','MB','GB','TB','PB','EB','ZB','YB'] :
			['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
		let u = -1;
		do {
			bytes /= thresh;
			++u;
		} while(Math.abs(bytes) >= thresh && u < units.length - 1);
		return bytes.toFixed(1)+' '+units[u];
	},
};

const form_reset_pw = {
	validity: [0, 0],
	init: function() {
		this.buildValidation();
	},
	buildValidation: function() {
		// password reset form for forgotten password
		var frm = $("#frm-resetpw");
		frm.find("#reset-pw").on('input', function() {
			form_reset_pw.validity[0] =
				form_reset_pw.validate_pass1(this.value);
			form_reset_pw.check_validity(form_reset_pw.validity);
		});
		frm.find("#reset-pw-confirm").on('input', function() {
			form_reset_pw.validity[1] =
				form_reset_pw.validate_pass2(this.value);
			form_reset_pw.check_validity(form_reset_pw.validity);
		});
	},
	validate_pass1: function(val) {
		// password is 1) required 2) at least 6 characters
		//             3) containing alphabet and number
		if (val.length < 6) {
			form_reset_pw.notify_error('pw',
				'Password must be at least 6 characters');
			return 0;
		}
		var regex = /\d/;
		if (!regex.test(val)) {
			form_reset_pw.notify_error('pw', 'Password must contain a number');
			return 0;
		}
		// otherwise valid
		form_reset_pw.field_valid("pw");
		return 1;
	},
	validate_pass2: function(val) {
		// pass2 must be the same as pass1
		if (!val || val !== $("#reset-pw").val()) {
			form_reset_pw.notify_error('pw-confirm', 'Password does not match');
			return 0;
		}
		form_reset_pw.field_valid('pw-confirm');
		return 1;
	},
	notify_error: function(id, msg) {
		$("#"+id+"-notify").text(msg);
		$("#reset-"+id).css("border-color", "red");
		$("#reset-submit")
			.prop("disabled", true)
			.addClass("btn-primary-outline")
			.removeClass("btn-primary");
	},
	field_valid: function(id) {
		$("#"+id+"-notify").text("");
		$("#reset-"+id).css("border-color", "green");
	},
	check_validity: function(rst) {
		// check if the form is ready to submit
		var allValid = rst.reduce(function (a, b) { return a * b; });
		if (allValid) {
			$("#reset-submit")
				.prop("disabled", false)
				.addClass("btn-primary")
				.removeClass("btn-primary-outline");
		}
	}
};

const auth = {
	stat: {
		su_submitting: false,       // status of submitting signup form
		lg_submitting: false,       // status of submitting login form
		timer: null,                // timer for input fields
		validity: [0, 0, 0, 0]     // [email, pass1, pass2, name]
	}, // stat
	init: function() {
		s = this.stat;
		// append hidden iframes for signup and login process
		$("body")
			.append('<iframe name="signup-frame" id="signup-frame"></iframe>')
			.append('<iframe name="login-frame" id="login-frame"></iframe>');
		this.buildValidation();
		this.buildAuthActions();
	}, // init()
	buildValidation: function() {
		// signup form -------------------------------------------------------
		$("#signup-email").on('input', function() {
			clearTimeout(s.timer);
			s.timer = setTimeout(function() {
				s.validity[0] = auth.validate_email($("#signup-email").val());
				auth.check_validity(s.validity);
			}, 400);
		});
		$("#signup-password").on('input', function() {
			s.validity[1] = auth.validate_pass1(this.value);
			auth.check_validity(s.validity);
		});
		$("#signup-pass-confirm").on('input', function() {
			s.validity[2] = auth.validate_pass2(this.value);
			auth.check_validity(s.validity);
		});
		$("#signup-fname").on('input', function() {
			s.validity[3] = auth.validate_name(this.value, 0);
			auth.check_validity(s.validity);
		});
		$("#signup-lname").on('input', function() {
			s.validity[3] = auth.validate_name(this.value, 1);
			auth.check_validity(s.validity);
		});
		$("#signup-fname").on('focusout', function() {
			s.validity[3] = auth.validate_name(this.value, 2);
			auth.check_validity(s.validity);
		});
		$("#signup-lname").on('focusout', function() {
			s.validity[3] = auth.validate_name(this.value, 3);
			auth.check_validity(s.validity);
		});
		$("#signup-aff").on('input', function() {
			if (this.value) {
				$("#signup-aff").css("border-color", "green");
			} else {
				$("#signup-aff").css("border-color", "");
			}
		});
		$("#modalSignup").on('hidden.bs.modal', function() {
			auth.signup_form_reset();
		});
		$("#modalLogin").on("hidden.bs.modal", function() {
			auth.login_form_reset();
		});
		$("#signup-form").on("submit", function(e) {
			s.su_submitting = true;
			$("#signup-submit").prop("disabled", true);
			$("#signup-loaderImg").show();
			/* ajax form submit */
			e.preventDefault();  // stop form from submitting normally
			var url = "krat_api.cgi";
			var password_hash = sha256($(this).find("#signup-password").val());
					// Sha256.hash($(this).find("#signup-password").val());
			var posting = $.post(url, {
				endpoint: "/users",
				email: $(this).find("#signup-email").val(),
				password: password_hash,
				fname: $(this).find("#signup-fname").val(),
				lname: $(this).find("#signup-lname").val(),
				affiliate: $(this).find("#signup-aff").val(),
				country: $(this).find("#signup-country").val(),
				website: $(this).find("#signup-website").val()
			});
			posting.done(function(response) {
				var data = JSON.parse(response);
				// console.log(data);
				$("#signup-loaderImg").hide();
				if (data.result === "success") {
					auth.signup_form_reset();
					$("#modalSignup").modal('hide');
					var msg = "Welcome! We've created your account and" +
						" have sent you an email confirmation message." +
						" Please verify your email address and login with" +
						" your credential.";
					alertify.alert('Successfuly created your account', msg,
						function() { window.location = "./home.cgi"; });
				} else {
					alertify.notify(data.message, 'error', 5);
				}
			});
		});
	}, // buildValidation()
	buildAuthActions: function() {
		// define actions
		$("#btnLogout").on('click', function() {
			//clean-up
			sessionStorage.clear();
			// Clear any DataTables states saved
			var tobedeleted = [];
			try {
				localStorage.length;
			} catch (e) {
				if(e.name == "NS_ERROR_FILE_CORRUPTED") {
					alertify.error("Browser storage has been corrupted. Move ~/.mozilla/firefox/....default/webappsstore.sqlite elsewhere.");
				}
			}
			for (let i=0; i < localStorage.length; i++) {
				if (localStorage.key(i).startsWith('DataTables')) {
					tobedeleted.push(localStorage.key(i));
				}
			}
			for (let i=0; i < tobedeleted.length; i++) {
				localStorage.removeItem(tobedeleted[i]);
			}
			window.location = "./logout.cgi";
		});
		$("#btnAdminPage").on('click', function() {
			window.location = "./admin.cgi";
		});
		// before submitting login form --------------------------------------
		$("#login-form").submit(function() {
			s.lg_submitting = true;
			$("#login-loaderImg").show();
			$("#signup-link").hide();
		});
		// check signup result or login session status when the associated
		// iframes are loaded
		$("#signup-frame").on('submit', function() {
			auth.checkSignupResult();
		});
		$("#login-frame").on('load', function() {
			auth.checkSession();
		});
		$("#signup-link").on('click', function() {
			auth.signup_form_reset();
			$("#modalSignup").modal('show');
		});
		$("#signup-link").hover(function() {
			$(this).css("text-decoration", "underline");
		}, function() {
			$(this).css("text-decoration", "none");
		});
	}, // buildAuthActions()
	// methods ===============================================================
	validate_email: function(val) {
		// email is 1) required 2) in valid email format 3) unique
		if (!val) {
			auth.notify_error("email", "Email is required field.");
			return 0;
		}
		var r = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
		if (!r.test(val)) {
			auth.notify_error("email", "Invalid email format");
			return 0;
		}
		/**
		 * Check if the given email address is registered (API)
		 * @param {{email_exists:int}} msg         Ajax response message
		 */
		$.ajax({
			type: "GET", dataType: "json", url: "./krat_api.cgi",
			data: { endpoint: "/ctrl/email_exists", email: val}
		}).done( function(msg) {
			if (msg.email_exists === 1) {
				auth.notify_error("email", "Email address already in use.");
				s.validity[0] = 0;
			}
		});
		// otherwise valid
		auth.field_valid("email");
		return 1;
	}, // validate_email()
	validate_pass1: function(val) {
		// password is 1) required 2) at least 6 characters
		//             3) containing alphabet and number
		if (val.length < 6) {
			form_reset_pw.notify_error('password',
				'password must be at least 6 characters');
			return 0;
		}
		var regex = /^([a-zA-Z0-9@*#]{6,15})$/;
		if (!regex.test(val)) {
			auth.notify_error('password',
					'Must contain only alphanumeric characters and must have ' +
					'a number');
			return 0;
		}
		// otherwise valid
		auth.field_valid("password");
		return 1;
	}, // validate_pass1()
	validate_pass2: function(val) {
		// pass2 must be the same as pass1
		if (!val || val !== $("#signup-password").val()) {
			auth.notify_error('pass-confirm', 'Password does not match');
			return 0;
		}
		auth.field_valid('pass-confirm');
		return 1;
	}, // validate_pass2()
	validate_name: function(val, mode) {
		var filled  = ($("#signup-fname").val() && $("#signup-lname").val());
		if (mode === 0 || mode === 1) { // fname or lname input
			if (!val) {
				auth.notify_error('name', 'name is required');
				if (mode === 0) $("#signup-fname").css('border-color', 'red');
				else $("#signup-lname").css('border-color', 'red');
				return 0;
			} else {
				if (mode === 0) $("#signup-fname").css("border-color", "green");
				else $("#signup-lname").css("border-color", "green");
				$("#name-notify").text("");
			}
			if (filled) return 1;
		} else if (mode === 2 || mode === 3) { // fname or lname focusout
			if (!val) {
				auth.notify_error('name', 'name is required');
				if (mode === 2) $("#signup-fname").css('border-color', 'red');
				else $("#signup-lname").css('border-color', 'red');
				return 0;
			}
			if (filled) return 1;
		}
	}, // validate_name()
	notify_error: function(id, msg) {
		$("#"+id+"-notify").text(msg);
		$("#signup-"+id).css("border-color", "red");
		$("#signup-submit")
			.prop("disabled", true)
			.addClass("btn-primary-outline")
			.removeClass("btn-primary");
	}, // notify_error()
	field_valid: function(id) {
		$("#"+id+"-notify").text("");
		$("#signup-"+id).css("border-color", "green");
	}, // field_valid()
	check_validity: function(rst) {
		// check if the form is ready to submit
		var allValid = rst.reduce(function (a, b) { return a * b; });
		if (allValid) {
			$("#signup-submit")
				.prop("disabled", false)
				.addClass("btn-primary")
				.removeClass("btn-primary-outline");
		}
	}, // check_validity()
	signup_form_reset: function() {
		s.su_submitting = false;
		$("#signup-submit").addClass("btn-primary-outline")
			.removeClass("btn-primary").prop("disabled", true);
		$("#signup-form").trigger("reset");
		$("#signup-form input").css("border-color", "");
		$("i[id*='valid']").hide();
		$("span.field-response").text("");
		$("#signup-fail").hide();
	}, // signup_form_reset()
	login_form_reset: function() {
		$("#login-submit").prop("disabled", false);
		$("#login-form").trigger("reset");
		$("#modalLogin #main-notify").text("");
		$("#signup-link").show();
	}, // login_form_reset()
	checkSession: function() {
		if (!s.lg_submitting) return;
		var sessid = utils.getCookie("CGISESSID");
		if (sessid !== "") {
			// check if session is valid
			$.ajax({
				type: "GET", dataType: "json", url: "krat_api.cgi",
				data: { endpoint: "/ctrl/is_session_valid", sessid: sessid }
			}).done( function(msg) {
				s.lg_submitting = false;
				$("#login-loaderImg").hide();
				if (msg.session_valid === 1) {
					// read jwt from login-frame content
					var rst = $.parseJSON($("#login-frame").contents().text());
					sessionStorage.setItem('jwt', rst.jwt);
					if (String(window.location).match(/confirm/g)) {
						// login from email confirmation page, go to home
						window.location = "home.cgi";
					} else {  // stay on the current page
						window.location = window.location;
					}
				} else {
					$("#modalLogin #main-notify")
						.text("Please check your ID/password again.");
					$("#login-form #login-pass").val("");
					$("#login-loaderImg").hide();
					$("#signup-link").show();
				}
			});
		} else {
			$("#modalLogin #main-notify")
				.text("Please check your ID/password again.");
			$("#login-form #login-pass").val("");
			$("#login-loaderImg").hide();
			$("#signup-link").show();
		}
	}, // checkSession()
	// accessed by hidden signup iframe
	checkSignupResult: function () {
		// console.log("in checkSignupResult");
		if (!s.su_submitting) return;
		// check if the email already exists
		$.ajax({
			type: "GET", dataType: "json", url: "krat_api.cgi",
			data: { endpoint: "/ctrl/email_exists", email: $("#signup-email").val() }
		}).done(function(msg) {
			s.su_submitting = false;
			$("#signup-submit").prop("disabled", false);
			if (msg.email_exists === 1) {
				$("#signup-loaderImg").hide();
				$("#modalSignup").modal('hide');
				window.location = "./home.cgi";
			} else {
				$("#signup-loaderImg").hide();
				$("#signup-fail").show();
				$("#signup-submit").prop("disabled", true);
			}
		});
	}, // checkSignupResult()
}; // auth

var project = {
	modalEditBatch: [
		'<!--edit project info-->\n' +
		'<div class="container-fluid">\n' +
		'  <div class="row">\n' +
		'    <div class="col">\n' +
		'      <p style="font-size:0.9rem; font-color:#444;">\n' +
		'You can choose to modify\n' +
		'only this project or all the selected projects below.\n' +
		'      </p>' +
		'      <div class="form-group" id="lst_rel_collections" ' +
		'           style="font-size:0.85rem;"></div>\n' +
		'    </div>\n' +
		'  </div>\n' +
		'</div>\n',
	],
	settings: {
		sessid: null,
		user: null,
		user_role: null,
		pid: null,
		projTable: null,
		data: null,
		// Adding language code to default settings. This might not matter later
		langCode: null
	},
	// Inititalise the HTML Data Table for project.cgi 
	init: function(pid) {
		//console.log("Table initialising"); 
		prj = this.settings;
		prj.sessid = utils.getCookie("CGISESSID");
		prj.user = utils.getCookie("USER");
		prj.pid = pid;
		prj.selectedProjects = [];
		prj.languages = []; // indexed by pid
		prj.versions = []; // indexed by pid
		// Adding array for language codes 
		prj.langCodes = []; 

		this.init_project_datatable();
		this.read_project_details(pid);
		this.buildActions(); 
	}, // init()
	// Set up the project datatable and its CSS attributes
	init_project_datatable: function() {
		if (prj.projTable === undefined) return;
		// console.log("initializing project table");
		prj.projTable = $('#tbl-proj').DataTable({
			"stateSave": false, // set to false bc it was annoying me
			"deferRender": true,
			"scrollY": '35vh',
			'scrollCollapse': true,
			"ajax": {
				"url": "krat_api.cgi?endpoint=/ctrl/get_myprojects_dataTable",
				"type": "GET",
				"beforeSend": function (xhr) {
					if (sessionStorage.getItem('jwt') !== null &&
							prj.sessid !== '') { // logged in, still logged in
						xhr.setRequestHeader("Authorization",
							"Bearer " + sessionStorage.getItem('jwt'));
					}
				},
			},
			"columnDefs": [{ // make some columns invisible
				"targets": [1],
				"visible": false,
				"searchable": true
			}, { // add content to column 0
				"targets": 0,
				"render": function(data, type, row, meta) {
					// add a button to each row, first column
					//console.log("rendering; data: " + data + "; row " + meta.row);
					//console.log("id = lang_" + data);  
					const prompt = (row[8].length == 1) ?
						"(Un)select" : "(Un)select all";
					return data + " <button " +
						"class='btn btn-sm btn-outline-primary' " +
						"id='selectAll" + row[8].join('_') + "' " +
						"style='font-size:10px;visibility:hidden;'" +
						"id='lang_" + meta.row + "' " +
						"onclick='project.selectAll([" + row[8] + "]);'>" +
						prompt + "<\/>";
				}
			}],
			"order": [[0,'asc']],
			'oLanguage': { "sSearch": "Filter projects:" },
			"createdRow": function (row, data, index) { 
				if (data[0] === String(prj.pid)) {
					$(row).addClass('highlight'); 
				}
			},
			// retroactively adds id to the filter bar so we can write
			// a search function for it
			"fnDrawCallback": function(oSettings) {
				$('.dataTables_filter input').attr("id", "sSearch");	
			},
		});
		// search function that searches by a desired column chosen
		// from the dropdown menu 
		$('#sSearch').on('keyup change', function () {
			// gets text from search input bar
			var keyword = $(this).val();
			// get HTML value of the option chosen in the drop down
			// the value in the dropdown is = to the column in the datatable
			var activeCol = $('#categorySelect').val();
			console.log("searching " + keyword + " in col " + activeCol); 
			// do search for that column only
			//console.log(prj.projTable.column(activeCol).data());
			prj.projTable.column(activeCol).search(keyword).draw(); 
			// If new option is selected from data table, clear search input
			// and reset table
			$('#categorySelect').on('change', function() {
					$('#sSearch').val('');
					prj.projTable.search(''); 
					prj.projTable.columns().search('');
					prj.projTable.draw();
			}); 
		});
		prj.projTable.draw();
	}, // init_project_datatable()
	init_map: function(lat, lng, zoom_lvl) {
		let global = (lat == 0 && lng == 0) ? true : false;
		let LatLng = new google.maps.LatLng(lat, lng);
		const myOptions = {
			zoom: parseInt(zoom_lvl),
			center: LatLng,
			mapTypeId: google.maps.MapTypeId.TERRAIN
		};
		if (global) {
			myOptions = {
				zoom:0,
				center: new google.maps.LatLng(12,12),
				mapTypeId: google.maps.MapTypeId.TERRAIN
			}
		}
		let map = new google.maps.Map(document.getElementById('gmap_canvas'), myOptions);
		if (!global) {
			let marker = new google.maps.Marker({ map: map, position: LatLng });
		}
	}, // init_map()
	// get country name by the given geo coordinates
	getCountryName: function(coder, lat, lng) {
		const LatLng = new google.maps.LatLng(lat, lng);
		let name = 'N/A';
		coder.geocode({'location': LatLng}, function (results, status) {
			if (status === 'OK' && results) {
				name = results[results.length - 1].formatted_address;
			}
			$("span#proj_geo-country").text(name);
		});
	}, // getCountryName()
	read_project_details: function(pid) {
		if (pid === undefined) return;
		let jwt = sessionStorage.getItem('jwt');
		let req_route, header;
		// jwt is expired and still logged in, just logout
		if (prj.sessid == '') { // not a problem; still see public projects
			// window.location = "./logout.cgi";
			// return;
		}
		req_route = "/project/[pid]";
		header = jwt ? {"Authorization": "Bearer " + jwt } : {};
		$.ajax({
			type: "GET", dataType: "json", url: "krat_api.cgi",
			data: {endpoint: req_route, pid: pid},
			headers: header
		}).done(function (data) {
			$("div#project_detail").show();
			prj.data = data.project;
			$("#projectName").text(prj.data.language + '/' + prj.data.version);
			project.fill_project_data();
			project.fill_project_member();
			if (prj.data.langCode !== null) {
				project.read_project_langCode(prj.data.langCode);
			}
			// initialize 'add collaborator'
			var collab_options = {
				url: function(phrase) {
					return "krat_api.cgi?endpoint=/users/search/[token]&token=" + phrase;
				},
				getValue: "email",
				template: {
					type: "custom",
					method: function(value, item) {
						return '<img src="'+item.iconsrc+'" style="width:25px;margin-right:5px;"/> '
							+ item.name+' - '+value;
					},
				},
				list: { maxNumberOfElements: 10, },
				theme: "plate-dark",
				requestDelay: 300,
			};
			$("input#txtSearchUser").easyAutocomplete(collab_options);
			let strPrjAccess = (prj.data.public == '0') ? 'public' : 'private';
			$("#proj_setting #btnAccessibility span").text(strPrjAccess);
		}).fail(function (jqXHR, textStatus) {
			$("div#project_detail").hide();
			$("div#project_notfound").show();
		});
	}, // read_project_details()
	read_project_langCode: function(lang_code) {
		$.ajax({
			type: "GET", dataType: "JSON", url: "krat_api.cgi",
			data: {endpoint: "/language/[code]", code: lang_code}
		}).done(function (data) {
			var lang_data = data.language;
			var codes = [];
			var k = 'glotto';
			if (k in lang_data && lang_data[k] && lang_data[k].length !== 0) {
				var url = 'http://glottolog.org/resource/languoid/id/' + lang_data[k];
				codes.push('Glotto (<a href="' + url + '" target="_blank">' + lang_data[k] + '</a>)');
			}
			k = 'iso639-3';
			if (k in lang_data && lang_data[k] && lang_data[k].length !== 0) {
				var url = "http://www-01.sil.org/iso639-3/documentation.asp?id=" + lang_data[k];
				codes.push('ISO639-3 (<a href="' + url + '" target="_blank">' + lang_data[k] + '</a>)');
			}
			k = 'wals';
			if (k in lang_data && lang_data[k] && lang_data[k].length !== 0) {
				var url = "http://wals.info/languoid/lect/wals_code_" + lang_data[k];
				codes.push('WALS (<a href="' + url + '" target="_blank">' + lang_data[k] + '</a>)');
			}
			k = 'multitree';
			if (k in lang_data && lang_data[k] && lang_data[k].length !== 0) {
				var url = "http://multitree.org/codes/" + lang_data[k];
				codes.push('MultiTree (<a href="' + url + '" target="_blank">' + lang_data[k] + '</a>)');
			}
			k = 'endangeredlanguages';
			if (k in lang_data && lang_data[k] && lang_data[k].length !== 0) {
				var url = "http://www.endangeredlanguages.com/lang/" + lang_data[k];
				codes.push('ELA (<a href="' + url + '" target="_blank">' + lang_data[k] + '</a>)');
			}
			var strCodes = codes.join(', ');
			// fill-in
			$("#proj_desc td#proj_desc-langCode").html(strCodes);
			$("#proj-geography span#proj_geo-lat").text(lang_data.latitude);
			$("#proj-geography span#proj_geo-lng").text(lang_data.longitude);
			// draw google map
			var lat = lang_data.latitude;
			var lng = lang_data.longitude;
			project.init_map(lat, lng, lang_data.map_zoom);
			var geocoder = new google.maps.Geocoder;
			project.getCountryName(geocoder, lat, lng);
		});
	}, // read_project_langCode()
	fill_project_member: function() {
		if (prj.data === null) {
			console.log('project data is not loaded');
			return;
		}
		$.ajax({
			type: "GET", dataType: "JSON", url: "krat_api.cgi",
			data: { endpoint: "/collaborators/p/[pid]", pid: prj.data.pid }
		}).done(function (data) {
			// project maintainer
			const owner_line = `<a href="profile.cgi?uid=${data.maintainer.uid}">` +
				`<img src="${data.maintainer.gravatar}" class="collab_gravatar"/>` +
				`${data.maintainer.name} (${data.maintainer.email})</a>`;
			$("#proj_member-maintainer").html(owner_line);
			// collaborators
			let strList = '';
			for (let i=0; i < data.collaborators.length; i++) {
				const c = data.collaborators[i];
				const removeBtn = (prj.user_role === 'admin' || prj.user_role === 'maintainer') ?
					`<span class="icon-minus btnRemoveCollab" aria-hidden="true" ` +
					` data-uid="${c.uid}"><span class="visuallyhidden">remove</span>` : '';
				const collab_line = `<a href="profile.cgi?uid=${c.uid}">` +
					`<img src="${c.gravatar}" class="collab_gravatar"/>${c.name} (${c.email})</a>`;
				strList = strList + '<span class="collaborator">' +
					`<a href="profile.cgi?uid=${c.uid}">${collab_line}</a>${removeBtn}</span>`;
			}
			$("#proj_member-collaborators").html(strList);
		}).fail(function (jqXHR, textStatus) {
			console.log("GET /collaborators/p/[pid] failed: " + textStatus);
		});
	}, // fill_project_member()
	fill_project_data: function() {
		if (prj.data === null) {
			console.log('project data is not loaded');
			return;
		}
		// console.log(prj.data);
		// Title
		$("#project-title").text(`${prj.data.language} (${prj.data.version})`);
		// Query form
		$("form#myForm input[name='project']").val(prj.data.pid);
		// Project Description
		$("#proj_desc td#proj_desc-language").html(prj.data.language);
		$("#proj_desc td#proj_desc-langCode").html(prj.data.langCode);
		$("#proj_desc td#proj_desc-dataType").html(prj.data.dataType);
		var accessibility = (prj.data.public == 1) ? "public" : "private";
			// careful: use ==, not ===, because public may be char or int; we
			// can't tell.
		$("#proj_desc td#proj_desc-public").html(accessibility);
		$("#proj_desc td#proj_desc-dtCreated").html(prj.data.tsUploaded);
		$("#proj_desc td#proj_desc-dtModified").html(prj.data.tsModified);
		// Provenance
		$("#proj-prov-cit div#provenance-panel div.panel-body").html(prj.data.provenance);
		$("#proj-prov-cit textarea#taProjProvenance").val(prj.data.provenance);
		if (prj.data.creator && prj.data.creator.length !== 0) {
			$("#proj-prov-cit span#proj_cit-creator").html(prj.data.creator);
			$("#proj-prov-cit input#creator").val(prj.data.creator);
		}
		if (prj.data.webSite && prj.data.webSite.length !== 0) {
			$("#proj-prov-cit span#proj_cit-webSite").html(prj.data.webSite);
			$("#proj-prov-cit input#webSite").val(prj.data.webSite);
		}
	},  // fill_project_data() // fill_project_data()
	oldScrollTo: function(idx) { // most likely not needed
		var offset = $('#tbl-proj tbody tr').eq(idx).offset().top -
			$('#tbl-proj tbody').offset().top - 50;
		$('.dataTables_scrollBody').animate({ scrollTop: offset }, 800)
	}, // oldScrollTo()
	update_prov_cit: function(pids) {
		if (!sessionStorage.getItem('jwt')) {
			$.notify('You don\'t seem logged in; not modifying.');
			return;
		}
		$.ajax({
			method: "POST", dataType: "json", url: "./krat_api.cgi",
			data: {
				endpoint: "PUT/project/[pid]/provCreatWeb",
				pid: pids,
				prov_body: $("#taProjProvenance").val().trim(),
				creator: $("#creator").val().trim(),
				webSite: $("#webSite").val().trim(),
			},
			headers: {'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')},
		}).done( function(data) {
			if (data.status >= 0) {
				$.notify(data.message);
			} else {
				$.notify(data.message, {type: 'danger'});
			}
			$("#btnUpdateProv").prop('disabled', true);
		}).fail( function($xhr, textStatus) {
			let data = $xhr.responseJSON;
			if (data.message !== null) {
				$.notify(data.message, {type: 'danger'});
			} else {
				console.log(textStatus);
			}
		});
	}, // update_prov_cit()
	add_collaborators: function(pids) {
		const target_user = $("#txtSearchUser").val();
		if (target_user.length <= 0) return;
		if (!sessionStorage.getItem('jwt')) {
			$.notify('You don\'t seem logged in; not modifying.');
			return;
		}
		$("#proj_member img#api-wait").show();
		$.ajax({
			method: "POST", dataType: "json", url: "krat_api.cgi",
			data: {
				endpoint: "PUT/collaborators/p/[pid]",
				email: target_user,
				pid: pids
			},
			headers: {'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')}
		}).done( function(data) {
			// reload collaborators list
			if (data.status > 0) {
				project.fill_project_member();
				$.notify(data.message);
			} else {
				$.notify(data.message, {type: 'danger'});
			}
		}).fail( function($xhr, textStatus) {
			var data = $xhr.responseJSON;
			if (data.message !== null) {
				$.notify(data.message, {type: 'danger'});
			} else {
				$.notify('[Failed] project update failed; ' + textStatus, {type: 'danger'});
			}
		}).always( function() {
			$("#proj_member img#api-wait").hide();
			$("#proj_member #txtSearchUser").val('');
		});
	}, // add_collaborators()
	remove_collaborators: function(pids, target_user) {
		if (!sessionStorage.getItem('jwt')) {
			$.notify('You don\'t seem logged in; not modifying.');
			return;
		}
		$.ajax({
			method: "GET", dataType: "json", url: "krat_api.cgi",
			data: {
				endpoint: "DEL/collaborators/p/[pid]/u/[uid]",
				uid: target_user,
				pid: pids
			},
			headers: {'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')}
		}).done( function(data) {
			if (data.status > 0) {
				// reload collaborators list
				project.fill_project_member();
				$.notify(data.message);
			} else {
				$.notify(data.message, {type: 'danger'});
			}
		}).fail( function($xhr, textStatus) {
			var data = $xhr.responseJSON;
			if (data.message !== null) {
				$.notify(data.message, {type: 'danger'});
			} else {
				$.notify('[Failed] project update failed; ' + textStatus, {type: 'danger'});
			}
		})
	}, // remove_collaborators() // remove_collaborators()
	update_accessibility: function(pids) {
		if (!sessionStorage.getItem('jwt')) {
			$.notify('You don\'t seem logged in; not modifying.');
			return;
		}
		// if only one, make conformation here
		$.ajax({
			method: "POST", dataType: "json", url: "krat_api.cgi",
			data: {
				endpoint: "PUT/project/[pid]/public",
				public: 1 - parseInt(prj.data.public),
				pid: pids
			},
			headers: {'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')}
		}).done( function(data) {
			$.notify(data.message);
			prj.data.public = (prj.data.public == '1') ? '0' : '1';
			let strProjAccess = (prj.data.public == '1') ? "public" : "private";
			let strProjAccess_not = (prj.data.public == '1') ? "private" : "public";
			$("#proj_desc td#proj_desc-public").html(strProjAccess);
			prj.projTable.ajax.reload();
			$("#proj_setting #btnAccessibility span").text(strProjAccess_not);
		}).fail( function($xhr) {
			var data = $xhr.responseJSON;
			$.notify(data.message, {type: 'error'});
		});
	}, // update_accessibility()
	delete_project: function(pids) {
		if (!sessionStorage.getItem('jwt')) {
			$.notify('You don\'t seem logged in; not modifying.');
			return;
		}
		console.log('in delete_project ' + pids);
		$.ajax({
			method: "POST", dataType: "json", url: "krat_api.cgi",
			data: {
				endpoint: "DEL/project/[pid]",
				pids: pids
			},
			headers: {'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')}
		}).done( function(data) {
			$.notify(data.message);
			if (data.status === 1) window.location = "project.cgi";
		}).fail( function($xhr) {
			var data = $xhr.responseJSON;
			$.notify(data.message, {type: 'error'});
		});
	}, // delete_project
	confirm_edit_batch: function(fn) {
		$.confirm({
			type: 'orange',
			title: 'Modifying Project Info',
			content: project.modalEditBatch[0],
			backgroundDismiss: true,
			columnClass: 'large',
			buttons: {
				btnCancel: {
					text:  'Cancel',
					btnClass: 'btn-danger',
					action: function () {
						// close
					}
				},
				btnToggleAll: {
					text: 'Toggle selection',
					btnClass: 'btn-success',
					action: function () {
						this.$content.find("input[name='relColl']").
							map(function() {
								this.checked = ! this.checked;
								console.log(this.checked);
								console.log(this);
							});
						return false; // prevent modal from closing
					}
				},
				btnEditAll: {
					text: 'All selected projects',
					btnClass: 'btn-info',
					action: function () {
						let checkedCollections = this.$content.find("input[name='relColl']:checked");
						let pids = checkedCollections
							.map( function () { return this.value; })
							.get().join(',');
						console.log("btnEditAll: " + pids);
						if (checkedCollections.length > 10) {
							$.confirm({
								title: "Update requests sent",
								content: 'It may take a while to apply the changes...',
								backgroundDismiss: true,
								autoClose: 'gotit|3000',
								buttons: {
									gotit: { 'text': 'Got It' }
								}
							})
						}
						fn(pids);
					}
				},
				btnEditSingle: {
					text: 'Just this project',
					btnClass: 'btn-info',
					action: function () {
						fn(prj.data.pid);
					}
				}
			},
			onContentReady: function () {
				let lstRelColls = this.$content.find('#lst_rel_collections');
				prj.data.related_collections.forEach(function (col) {
					let html = '<div class="form-check">\n';
					let pid = col[0];
					let version = col[1];
					html += '<input class="form-check-input" type="checkbox" value="' + pid +
						'" id="relColl-' + pid + '" name="relColl" checked>';
					html += '<label class="form-check-label" for="relColl-' + pid + '">' +
						version + '</label>';
					lstRelColls.append(html);
				});
			}
		})
	}, // confirm_edit_batch()
	// Function that creats children below each main row in the table
	// Consisting of the projects within the language
	buildActions: function() {
		$("#tbl-proj>tbody").on('click', 'tr', function() {
			var row = prj.projTable.row($(this));
			if (row.child.isShown()) { // time to close it
				row.child.hide();
			} else if (!row.data()) { // click inside a child row
			} else if (row.child()) { // already have a child
				row.child.show();
			} else { // build child composed of rows for versions 
				const pids = row.data()[8];
				const language = row.data()[0];
				const versions = row.data()[7];
				// Adding language code array 
				const langCodes = row.data()[1]; 
				// Creates the button for the parent row's select, which
				// selects all child projects below it when clicked
				document.getElementById("selectAll" + pids.join('_')).style.
					visibility = 'visible';
				var newTable = ''; // child lines
				newTable += '<table class="table table-sm table-striped ';
				newTable += 'table-bordered table-hover" style="font-size:10px;">';
				var index;
				for (index = 0; index < versions.length; index += 1) {
					prj.languages[pids[index]] = language;
					prj.langCodes[pids[index]] = langCodes;
					prj.versions[pids[index]] = versions[index];
					newTable += '<tr><td>';
					newTable += versions[index];
					console.log("lang code: " + langCodes); 
					// The buttons below need to be accessed by PID because it 
					// deals with each individual project. 
					newTable += ' <button class="btn btn-sm btn-outline-primary" ';
					newTable += 'style="font-size:10px;" ';
					newTable += 'onclick="project.showDetails(' + pids[index] + ');">';
					newTable += 'Details';
					newTable += '<\/button>';
					newTable += '<button class="btn btn-sm btn-outline-primary" ';
					newTable += 'style="font-size:10px;" ';
					newTable += 'onclick="project.selectProject(' + pids[index];
					newTable += ');">(Un)select<\/button>';
					var myTypes = row.data()[3].split(/\//);
					var typeIndex;
					for (typeIndex = 0; typeIndex < myTypes.length;
							typeIndex += 1) {
						newTable += ' <button class="btn btn-sm btn-outline-primary" ';
						newTable += 'style="font-size:10px;" ';
						newTable += 'onclick="display.toContinuous(undefined,';
						newTable += pids[index];
						newTable += ',\'';
						newTable += myTypes[typeIndex];
						newTable += '\');">Read';
						if (myTypes.length > 1) {
							newTable += ' ' + myTypes[typeIndex];
						}
						newTable += '</button>';
					} // each type
					newTable += '</td></tr>';
				} // each version
				newTable += '</table>';
				row.child(newTable).show();
			}
		});
		// provenance
		$('#proj-prov-cit input,textarea').bind('input propertychange', function() {
			$("#btnUpdateProv").prop('disabled', false);
		});
		$("#proj-prov-cit").on('click', '#btnUpdateProv', function() {
			// this will open confirmation modal or just request single collection edit if
			// no related collection found.
			if (prj.data.related_collections.length > 1) {
				project.confirm_edit_batch(project.update_prov_cit);
			} else {
				project.update_prov_cit(prj.data.pid);
			}
		});
		// Add a collaborator
		$("#proj_member").on('click', '#btnAddCollab', function() {
			// Do nothing when the input is none
			let val = $("#proj_member #txtSearchUser").val();
			if (val === '') {
				return false;
			}
			if (prj.data.related_collections.length > 1) {
				project.confirm_edit_batch(project.add_collaborators);
			} else {
				project.add_collaborators(prj.data.pid);
			}
		});
		// Remove a collaborator
		$("#proj_member ul").on('click', '.btnRemoveCollab', function () {
			// const target_user = $(this).attr('data-uid');
			let target_user = $(this).data('uid');
			let strCollaborator = $(this).prev().text();
			let msg = '<div class="alert alert-warning" role="alert">' +
				'This member will be removed from the collaborators list:<br/>' +
				strCollaborator + '</div>';
			// Currying for a partial function
			let curryingFn = uid => pids => project.remove_collaborators(pids, uid);
			// const fn_remove_collaborator =
			// 	user => pids => project.remove_collaborators(pids, user);
			let partialFn = curryingFn(target_user);
			// let partial_fn = fn_remove_collaborator(target_user);
			if (prj.data.related_collections.length > 1) {
				project.confirm_edit_batch(partialFn);
			} else {
				$.confirm({
					type: 'orange',
					title: 'Remove a collaborator',
					content: msg,
					backgroundDismiss: true,
					columnClass: 'large',
					buttons: {
						cancel: function() {},
						confirm: {
							btnClass: 'btn-info',
							action: function() {
								partialFn(prj.data.pid);
							}
						},
					}
				})
			}
		});
		// Switch the project accessibility
		$("#proj_setting").on('click', '#btnAccessibility', function() {
			// Similarly this will open confirmation modal for editing in batch
			if (prj.data.related_collections.length > 1) {
				project.confirm_edit_batch(project.update_accessibility)
			} else {
				project.update_accessibility(prj.data.pid);
			}
		});
		$("#proj_setting").on('click', '#btnDelete', function() {
			// Always this open confirmation modal for deleting
			project.confirm_edit_batch(project.delete_project)
		});
	}, // buildActions()
	clearSelected: function() {
		const theSpan = document.getElementById('selectedProjects');
		theSpan.style.visibility = 'hidden';
		prj.selectedProjects = [];
		const theList = document.getElementById('selectedList');
		theList.innerHTML = '';
	}, // clearSelected
	selectProject: function(pid) {
		const theSpan = document.getElementById('selectedProjects');
		theSpan.style.visibility = 'visible';
		if (prj.selectedProjects[pid] === pid) { // already exists
			prj.selectedProjects[pid] = undefined;
		} else {
			prj.selectedProjects[pid] = pid;
		}
		const theProjects =
			prj.selectedProjects.filter(value => value !== undefined);
		var names = [];
		for (var index = 0; index < theProjects.length; index += 1) {
			const pid = theProjects[index];	
			var theName = prj.languages[pid];
			const theVersion = prj.versions[pid];
			if (theVersion !== 'base') {
				theName += '/' + theVersion;
			}
			names.push(theName);
		}
		const theList = document.getElementById('selectedList');
		if (names.length) {
			theList.innerHTML = names.join(", ");
		} else {
			theList.innerHTML = '';
			theSpan.style.visibility = 'hidden';
		}
	}, // selectProject
	selectAll: function(pids) {
		for (var index = 0; index < pids.length; index += 1) {
			const thePid = pids[index];
			console.log("select all: pid " + thePid);
			project.selectProject(thePid);
		} // each parameter
	}, // selectAll
	search: function() { // invoke search on the selected pids.
		var form = document.createElement("form");
		form.setAttribute('method', 'POST');
		form.setAttribute('action', 'display.cgi');
		display.addInputElt(form, 'firstShown', 1);
		display.addInputElt(form, 'lastShown', 1);
		display.addInputElt(form, 'query', '');
		const theProjects =
			prj.selectedProjects.filter(value => value !== undefined);
		for (var index = 0; index < theProjects.length; index += 1) {
			display.addInputElt(form, 'project', theProjects[index]);
		} // each project
		document.body.appendChild(form);
		form.submit();
		return false;
	}, // search
	showDetails: function(pid) { // open a tab with the details
		var form = document.createElement("form");
		form.setAttribute('method', 'POST');
		form.setAttribute('action', 'project.cgi');
		form.setAttribute('target', '_blank');
		display.addInputElt(form, 'pid', pid);
		document.body.appendChild(form);
		form.submit();
		$.notify('The result is in a new tab');
		return false;
	}, // showDetails
}; // project

var profile = {
	settings: {
		sessid: null,
		user: null
	},
	init: function() {
		p = this.settings;
		p.sessid = utils.getCookie("CGISESSID");
		p.user = utils.getCookie("USER");
		// build event actions on profile page
		this.buildActions();
	}, // init()
	buildActions: function() {
		// resend email verification email
		$("#btnSendEmailVerify").on('click', function() {
			$.ajax({
				type: "GET", dataType: "json", url: "krat_api.cgi",
				data: { endpoint: "/ctrl/send_email_verification", email: $("#req_e").attr('value') }
			}).done(function(msg) {
				if (msg.email_sent === 1) {
					alertify.notify('Please check your emails and verify the registration', 'success', 5);
				} else {
					alertify.error(msg.data);
				}
			});
		});
	}, // buildActions()
}; // profile

var dataUpload = {
	settings: {
		fileAPIavail: false,
		xhrAvail: false,
		MAX_FILE_SIZE: 1024 * 1024 * 100,
		action: null,
		pgBar: null,
		fileSelected: null,
		overwriting: false
	},
	delayTimer: null,
	init: function() {
		us = this.settings;
		this.upload_frm = $("#upload-frm");
		us.action = this.upload_frm.attr("action");
		us.pgBar = $("#pgb1");
		var xhr = new XMLHttpRequest();
		var fileselect = $("#file"),
			filedrag = $("#filedrag");
		// is File API available?
		if (window.File && window.FileList && window.FileReader) {
			us.fileAPIavail = true;
			//event handler
			fileselect.on('change', function (e) {
				filedrag.text($(this)[0].files[0].name);
				dataUpload.FileSelectHandler(e);
			}).css("color", "transparent");
		}
		// is XHR2 available?
		if (xhr.upload) {
			us.xhrAvail= true;
			// file drop
			filedrag[0].addEventListener("dragover", this.FileDragHover);
			filedrag[0].addEventListener("dragleave", this.FileDragHover);
			filedrag[0].addEventListener("drop", this.FileSelectHandler);
			filedrag.show();
		}
		// bind submit event
		this.upload_frm.submit( function(e) {
			if (us.xhrAvail) {
				$("#up-progress").show();
				$("#btn-sbm").hide();
				$("#btn-reset").hide();
				if (!us.fileSelected || !$("input#language").val()) {
				   dataUpload.pgBarError("Language name and data file must be provided");
				} else {
					dataUpload.sendMetaFields();
				}
				e.preventDefault();
			}
		});
		$('#btn-reset').on('click', function(e) {
			$('#up-progress').hide();
			dataUpload.pgBarReset();
			$('#filedrag').text('or drop files here');
			$(this).hide();
			this.upload_frm[0].reset();
			$("#overwrite-warn").hide();
			us.overwriting = false;
		});
		this.upload_frm.find("#language").on('change', function(e) {
				dataUpload.searchProject({loadData: true});
			});
		this.upload_frm.find("#version").on('keyup change', function(e) {
			dataUpload.searchProject({loadData: true});
		});
		this.upload_frm.find("#provenance").on('keyup change', function(e) {
			if (us.overwriting === false) {
				dataUpload.searchProject();
			}
		});
		this.upload_frm.find("#public").on('change', function(e) {
			if (us.overwriting === false) {
				dataUpload.searchProject();
			}
		});
		this.upload_frm.find("#file").on('change', function(e) {
			if (us.overwriting === false) {
				dataUpload.searchProject();
			}
		});
	}, // init()
	FileDragHover: function(e) {
		e.stopPropagation();
		e.preventDefault();
		e.target.className = (e.type === "dragover") ? "hover" : "";
	}, // FileDragHover()
	FileSelectHandler: function(e) {
		// cancel event and hover style
		dataUpload.FileDragHover(e);
		// fetch FileList object
		us.fileSelected = e.target.files || e.dataTransfer.files;
		// process all File objects
		// (uploading multiple files available, but here one file to be uploaded)
		for (var i = 0; i < us.fileSelected.length; i++) {
			var f = us.fileSelected[i];
			$("#filedrag").text(f.name + ' [ ' +
								utils.humanFileSize(f.size, true) + ' ]');
			dataUpload.ParseFile(f);
		}
		dataUpload.searchProject();
	}, // FileSelectHandler()
	pgBarError: function(msg) {
		us.pgBar.removeClass("active progress-bar-striped")
			.addClass("progress-bar-danger")
			.css("width", "100%")
			.html("Error. " + msg);
		$("#btn-sbm").show();
	}, // pgBarError()
	pgBarReset: function() {
		us.pgBar.addClass("active progress-bar-striped")
		   .removeClass("progress-bar-danger progress-bar-info")
		   .removeClass("progress-bar-success progress-bar-warning")
		   .css("width", "20%")
		   .html("");
	}, // pgBarReset()
	sendMetaFields: function() {
		$.post(us.action, {
			req_mode: 'ajax-meta',
			language: $("#language").val(),
			langCode: $("#langCode").val(),
			version: $("#version").val(),
			owner: $("#owner").val(),
			public: $("#public").prop('checked') ? 1 : 0,
			overwrite: $("#overwrite").prop('checked') ? 1 : 0,
			provenance: $("#provenance").val(),
			creator: $("#creator").val(),
			webSite: $("#webSite").val(),
			existingColl: $("#existingColl").val()
		})
		.done(function(data) {
			if (data.result != "success") {
				dataUpload.pgBarError(data.data);
			} else {
				// on success
				// start next process (uploading file)
				if (typeof us.fileSelected !== "undefined" &&
						us.fileSelected !== null &&
						us.fileSelected.length > 0) {
					for (var i = 0; i < us.fileSelected.length; i++) {
						var f = us.fileSelected[i];
						dataUpload.UploadFile(f, data.data);
					}
				} else {
					dataUpload.pgBarError("Data file is not chosen");
				}
			}
		})
		.fail(function() {
			// on fail
			$("#pgb1")
				.removeClass("active")
				.addClass("progress-bar-danger")
				.html("Error. Unable to establish a connection");
		});
	}, // sendMetaFields()
	ParseFile: function(file) {
		$("#formResp").append(
				"<p>File information: <strong>" + file.name +
				"</strong> type: <strong>" + file.type +
				"</strong> size: <strong>" + file.size +
				"</strong> bytes</p>"
				);
	}, // ParseFile()
	UploadFile: function(file, pid) {
		dataUpload.pgBarReset();
		var formData = new FormData();
		formData.append('filename', file.name);
		formData.append('req_mode', 'ajax-file');
		formData.append('pid', pid);
		formData.append('file', file);
		$.ajax({
			type: 'POST',
			url: us.action,
			data: formData,
			cache: false,
			processData: false,
			contentType: false,
			timeout: 1000 * 60 * 1.5,  // 1.5 min timeout
			xhr: function() {
				var myXhr = $.ajaxSettings.xhr();
				if (myXhr.upload && file.size <= us.MAX_FILE_SIZE) {
					myXhr.upload.addEventListener('progress', function(e) {
						var pct = (e.total ===0) ? 0 : parseInt(e.loaded / e.total * 100);
						us.pgBar.css('width', pct + '%');
						us.pgBar.html('File Uploading: ' + pct + '% completed');
						if (pct === 100) {
							us.pgBar.html('Analyzing Data File. It may ' +
									'take several minutes.');
						}
					}, false);
				}
				return myXhr;
			} // xhr()
		}).done(function (data) {
			if (data.result !== 'success') {
				dataUpload.pgBarError(data.data);
			} else {
				// on success
				us.pgBar.removeClass('active progress-bar-striped')
					.addClass('progress-bar-success');
				us.pgBar.html(data.data);
				$("#btn-sbm").text('Submit More').show();
				$("#btn-reset").show();
			}
		}).fail(function(jqXHR, textStatus) {
			if (textStatus === 'timeout') {
				us.pgBar.removeClass('active progress-bar-striped')
					.addClass('progress-bar-warning');
				var msg = "Timeout. Data file is submitted, but the" +
					" parser is still in process. Please check the" +
					" status on project page.";
				us.pgBar.html(msg);
				$("#btn-sbm").text('Submit More').show();
				$("#btn-reset").show();
			} else {
				us.pgBar.removeClass('active progress-bar-striped')
					.addClass('progress-bar-warning');
				var msg = "Unknown error: " + textStatus + 
					"; perhaps upload succeeded."
				us.pgBar.html(msg);
				$("#btn-sbm").text('Submit More').show();
				$("#btn-reset").show();
			}
		});
	}, // UploadFile()
	searchProject: function (args) {
		if (!args) args = {};
		if (!args.loadData) args.loadData = false;
		clearTimeout(this.delayTimer);
		this.delayTimer = setTimeout(function() {
			var lang = $("#upload-frm #language").val();
			var coll = $("#upload-frm #version").val();
			// Do the ajax stuff
			if (lang) {
				if (coll == '') {
					coll = 'base';
				}
				$.ajax({
					type: "GET",
					dataType: "json",
					url: "./krat_api.cgi",
					data: { endpoint: "/project/[name]", language: lang, version: coll }
				}).done(function(resp) {
					console.log("found " + lang + ' / ' + coll);
					us.overwriting = true;
					$("#existingColl").val(resp.project.pid);
					$("#overwrite-warn").show();
					if (args.loadData) {
						if (resp.project.public == "1") {
							$("#upload-frm #public").prop("checked", true);
						} else {
							$("#upload-frm #public").prop("checked", false);
						}
						$("#upload-frm #provenance").val(resp.project.provenance);
						$("#upload-frm #creator").val(resp.project.creator);
						$("#upload-frm #webSite").val(resp.project.webSite);
					}
				}).fail(function(resp) {
					console.log("missed " + lang + ' / ' + coll);
					us.overwriting = false;
					$("#existingColl").val('');
					$("#overwrite-warn").hide();
					if (args.loadData) {
						$("#upload-frm #public").prop("checked", false);
						$("#upload-frm #provenance").val('');
						$("#upload-frm #creator").val('');
						$("#upload-frm #webSite").val('');
					}
				});
			}
		}, 1000); // Will do the AJAX stuff after 1000 ms, or 1 s
	}, // searchProject()
}; // dataUpload

var display = {
	settings: {
		visibility: {}, // current configuration: 0 means hide, 1 means show
		visibility0: {},  // default configuration
		projects: null,
		feedbackPointer: null,
		doublePaneMode: 'single',
	},
	init: function() {
		dp = display.settings;
		// Initialize notifier
		$.notifyDefaults({
			type: 'success',
			delay: 3000,
			placement: { from: 'bottom', align: 'right' }
		});
		display.initContextMenu();
		// Check if any of the projects should be displayed on the right pane
		display.initDoublePane();
		/********************** Event Triggers **************************/
		// debug
		$("#debug").on('click', function() { $("#debug #contents").toggle(); });
		$('[data-toggle="tooltip"]').tooltip();
		$('[data-taggle="tooltip"]').tooltip(); // for dropdown data-toggle
		$("#fb-submit").on('click', function() {
			// update formData
			var formdata = new FormData($("#feedbackMsg #fb-form")[0]);
			var contents = dp.feedbackPointer.
				find(".rst-contents").filter(":visible");
			formdata.append("fb-coll-pid", contents.attr("data-pid"));
			var zoomLevel = 2.0;
			$("#fb-notif").show();
			$("#fb-notif #fb-notif-message").text("preparing screenshot...");
			domtoimage.toPng(contents[0], {
				bgcolor : 'white',  // if you omit, you get "transparent"
				height : zoomLevel * (contents[0].scrollHeight + 100),
				width : zoomLevel * (contents[0].scrollWidth + 100),
				style : {
					'padding': '10px',
					'transform': 'scale(' + zoomLevel + ')',
					'transform-origin': 'top left'
				}
			}).then(function(dataURI) {
				var blob = display.dataURItoBlob(dataURI);
				formdata.append("entryImage", blob);
				$("#fb-notif #fb-notif-message").text("sending message...");
				display.submitFeedback(formdata);
			});
		});
		// TextAnnotation submit
		$("#btnSubmitTextAnnt").on('click', function() {
			if (!sessionStorage.getItem('jwt')) {
				$.notify('You don\'t seem logged in; not modifying.');
				return;
			}
			var anntModal = $("#modalAnnotation");
			$.ajax({
				url: "annotation_upload.cgi", method: "POST", dataType: "json",
				headers: {
					"Authorization": "Bearer " + sessionStorage.getItem('jwt')
				},
				data: {
					endpoint: "addTextAnnotation",
					pid: anntModal.find('#annt-pid').val(),
					projectPath:  anntModal.find('#annt-projectPath').val(),
					entryId:  anntModal.find('#annt-entryId').val(),
					body: {
						text: anntModal.find('#anntText').val(),
					},
				}
			}).done(function(data) {
				if (data.status_code === 200) {
					$.notify(data.message, {delay: 5000});
					$("#modalAnnotation").modal('hide');
				} else {
					let msg = data.message + ' [status_code: ' + data.status_code + ']';
					$.notify(msg, {delay: 5000, type: 'danger'});
				}
			}).fail(function($XHR, textStatus ) {
				let data = $XHR.responseJSON;
				if (data.message !== null) {
					let msg = "[Request failed] " + data.message;
					$.notify(msg, {delay: 5000, type: 'danger'});
				} else {
					console.log(textStatus);
				}
			});
		});
		$("ul#anntList").on('click', '.delete-annt', function() {
			var anntModal = $("#modalAnnotation");
			console.log(anntModal.find('#annt-entryId').val());
			console.log($(this).parents('li').data('fid'));
			if (!sessionStorage.getItem('jwt')) {
				$.notify('You don\'t seem logged in; not modifying.');
				return;
			}
			$.ajax({
				url: "annotation_upload.cgi", method: "GET", dataType: "json",
				headers: {
					"Authorization": "Bearer " + sessionStorage.getItem('jwt')
				},
				data: {
					endpoint: "deleteAnnotationFile",
					pid: anntModal.find('#annt-pid').val(),
					projectPath:  anntModal.find('#annt-projectPath').val(),
					entryId:  anntModal.find('#annt-entryId').val(),
					fid: $(this).parents("li").data('fid')
				}
			}).done(function(data) {
				if (data.status_code === 200) {
					$.notify(data.message, {delay: 5000});
					$("#modalAnnotation").modal('hide');
				} else {
					let msg = data.message + ' [status_code: ' + data.status_code + ']';
					$.notify(msg, {delay: 5000, type: 'danger'});
				}
			}).fail(function($XHR, textStatus ) {
				let data = $XHR.responseJSON;
				if (data.message !== null) {
					let msg = "[Request failed] " + data.message;
					$.notify(msg, {delay: 5000, type: 'danger'});
				} else {
					console.log(textStatus);
				}
			});
		});
		$("#modalAnnotation").on("hidden.bs.modal", function(){
			// reset the modal when it's closed
			var anntModal = $("#modalAnnotation");
			anntModal.find('#annt-pid').val('');
			anntModal.find('#annt-projectPath').val('');
			anntModal.find('#annt-entryId').val('');
			anntModal.find('#anntText').val('');
			anntModal.find("#span-uploading-media").hide();
			anntModal.find("#btnSubmitMedia").prop('disabled', false);
			$("#mediaAnnotationForm")[0].reset();
		}).on("show.bs.modal", function(e) {
			// set the entry information on the annotation modal
			var invoker = $(e.relatedTarget);
			var entry = invoker.parents('.rst-entry');
			var entryData = entry.find('.rst-contents.linear').data();
			var anntModal = $("#modalAnnotation");
			anntModal.find('#annt-pid').val(entryData.pid);
			anntModal.find("#annt-projectPath").val(entryData.projectpath);
			anntModal.find("#annt-entryId").val(invoker.data('entryid'));
			var annotationList = entry.find(".annotationFiles").html();
			anntModal.find("#anntList").html(annotationList);
			display.toggleAnnotation(invoker.data('entryid'));
		});
		// btnShowAnnotation
		$(".rst-contents.linear").on('click', '.btnShowAnnotation', function() {
			var entryId = $(this).data('entry');
			display.toggleAnnotation(entryId);
			// $(this).hide();
		});
		// Media annotation submit
		$("#mediaAnnotationForm").submit(function(e) {
			e.preventDefault();
			var anntModal = $("#modalAnnotation");
			var files = $("#fileupload")[0].files;
			var formData = new FormData();
			if (!sessionStorage.getItem('jwt')) {
				$.notify('You don\'t seem logged in; not modifying.');
				return;
			}
			formData.append('file', files[0]);
			formData.append('endpoint', 'addMediaAnnotation');
			formData.append('pid', anntModal.find('#annt-pid').val());
			formData.append('projectPath', anntModal.find('#annt-projectPath').val());
			formData.append('entryId', anntModal.find('#annt-entryId').val());
			// Disable button and display loading gif
			$("#span-uploading-media").show();
			$("#btnSubmitMedia").prop('disabled', true);
			$.ajax({
				url: "annotation_upload.cgi", method: "POST", dataType: "json",
				headers: {
					"Authorization": "Bearer " + sessionStorage.getItem('jwt')
				},
				data: formData,
				processData: false,
				contentType: false,
				timeout: 1000 * 60 * 2,  // 2 min timeout
			}).done(function(data) {
				if (data.status_code === 200) {
					$.notify(data.message);
					$("#modalAnnotation").modal('hide');
				} else {
					let msg = data.message + ' [status_code: ' + data.status_code + ']';
					$.notify(msg, {delay: 5000, type: 'danger'});
				}
			}).fail(function($XHR, textStatus ) {
				let data = $XHR.responseJSON;
				if (data.message !== null) {
					let msg = "[Request failed] " + data.message;
					$.notify(msg, {delay: 5000, type: 'danger'});
				} else {
					console.log(textStatus);
				}
			}).always(function() {
				$("#span-uploading-media").hide();
				$("#btnSubmitMedia").prop('disabled', false);
			});
		});
		if ($("#myForm [name|=queryType]:checked").val() === undefined) {
			display.initScrollMore();
		} // continuous
	}, // init()
	initDoublePane: function() { // two-pane arrangement
		// Double-pane events
		let projectsOnRight = JSON.parse(sessionStorage.getItem("projectsOnRight"));
		if (projectsOnRight != null && projectsOnRight.length > 0) {
			projectsOnRight.forEach(function(pid) {
				if (dp.projects.includes(pid)) {
					if (dp.doublePaneMode === 'signle') display.splitPane();
					// Move the project entry to the right side
					const projectTitle =
						$(".double-pane-container .left-pane .coll-container .rst-title[data-pid='"+pid+"']");
					const entry = projectTitle.parents('.coll-container')
					const target = entry.parent().parent().siblings().first().find('.right-pane');
					target.append(entry);
					// Check if any of the columns is empty, then merge into one column
					display.mergePanes();
				}
			});
		}
		// let wHeight = $(window).height();
		// $('.double-pane-container').css({ 'height' : wHeight + 'px' });
		$(".pos-menu").on('click', '.btn-move-top', function() {
			const entry = $(this).parents(".coll-container");
			entry.parent().prepend(entry);
		}).on('click', '.btn-move-bottom', function() {
			const entry = $(this).parents(".coll-container");
			entry.parent().append(entry);
		}).on('click', '.btn-move-opposite', function() {
			if (dp.doublePaneMode === 'single') display.splitPane();
			const entry = $(this).parents(".coll-container");
			const target = entry.parent().parent().siblings().first().find(".container-fluid");
			target.append(entry);
			// Check if any of the columns is empty, then merge into one column
			display.mergePanes()
		});
	}, // initDoublePane()
	splitPane: function() { // two-pane arrangement
		$(".single-pane-container")
			.addClass("double-pane-container")
			.removeClass("single-pane-container")
			.find(".pane").addClass("col-6").removeClass("col-12")
			.find(".container-fluid").addClass("left-pane");
		$(".double-pane-container")
			.append('<div class="pane col-6"><div class="container-fluid right-pane"></div></div>');
		dp.doublePaneMode = 'double';
	}, // splitPane()
	mergePanes: function() { // two-pane arrangement
		let emptyCol = null;
		let fullCol = null;
		if ($(".left-pane").children().length === 0) {
			emptyCol = $(".left-pane");
			fullCol = $(".right-pane");
		} else if ($(".right-pane").children().length === 0) {
			emptyCol = $(".right-pane");
			fullCol = $(".left-pane");
		} else {
			return 0;
		}
		emptyCol.parent().remove();
		fullCol.parents(".double-pane-container")
			.addClass("single-pane-container").removeClass("double-pane-container");
		fullCol.parent().addClass("col-12").removeClass("col-6");
		fullCol.removeClass("left-pane right-pane");
		dp.doublePaneMode = 'single';
		return 1;
	}, // mergePanes()
	updateProjectsOnRight: function() { // two-pane arrangement
		let rightPane = $(".double-pane-container .right-pane .coll-container");
		let projectList = [];
		if (rightPane.length > 0) {
			rightPane.each(function() { projectList.push($(this).find(".rst-title").data("pid")); });
		}
		if (projectList.length > 0) {
			sessionStorage.setItem("projectsOnRight", JSON.stringify(projectList));
		} else {
			sessionStorage.removeItem("projectsOnRight");
		}
	}, // updateProjectsOnRight()
	initContextMenu: function() { // pop-up on left-click inside result
		// activate jquery contextMenu
		$.contextMenu({
			selector: 'span.cm,table.cm',
			trigger: 'left',
			build: function ($tg, e) {
				return { items: {
					"hide": {
						name: "hide '" + $tg.attr('data-original-title') + "' tier",
						accesskey: 'h',
						callback: function(key, options) {
							display.flip($tg.attr('data-elm-name'));
							display.updateVisibilityCookie();
						}
					},
					"dispAll": {
						name: "show all tiers",
						accesskey: 's',
						callback: function(key, options) {
							display.revealAll();
							display.updateVisibilityCookie();
						}
					},
					"restoreVis": {
						name: "restore default visibility",
						accesskey: 'r',
						callback: function(key, options) {
							for (var elm in dp.visibility0) {
								if (dp.visibility0[elm] === 0) {
									display.hide(elm);
								} else {
									display.reveal(elm);
								}
							}
							Cookies.set('dp_visibility', dp.visibility0, { expires: 7 });
						}
					},
					"search": {
						name: "query this value",
						accesskey: 'q',
						callback: function(key, options) {
							// console.log($tg.text());
							$("#myForm #query").val($tg.text());
							// $("#myForm #filter").val('');
							$("#myForm #firstShown").val(1);
							$("#myForm [name=queryType]").attr('checked', false);
							$("#myForm #string").attr('checked', true);
							$("#myForm").submit();
						}
					},
					"filter": {
						name: "filter search on this tier",
						accesskey: 'f',
						callback: function(key, options) {
							let filterName = $tg.attr('data-elm-name');
							filterName = filterName.replace(/(.*)_(.*)/,
								function(match,type,tier) {
									return tier + ' ' + type;
								});
							$("#myForm #filter").val(filterName);
						}
					},
					"modify": {
						name: "modify this value",
						accesskey: 'm',
						callback: function(key, options) {
							var modal = $("#modifyEntry");
							// modal.find("#modifyValue").text($tg.text());
							modal.find("#modifyValue").val($tg.text());
							modal.find("#modifyValue").
								css('backgroundColor', 'yellow');
							modal.find("#modifyAccept").css('display', 'none');
							modal.modal('show');
							display.elementToModify = $tg;
						} // callback function
					}, // modify
				} };
			}
		});
	}, // initContextMenu()
	submitFeedback: function(formdata) {
		var clear_close = function() {
			// clear and close the modal
			$("#feedbackMsg #fb-form")[0].reset();
			$("#feedbackMsg").modal('hide');
			formdata = null;
			dp.feedbackPointer = null;
		};
		if (!sessionStorage.getItem('jwt')) {
			$.notify('You don\'t seem logged in; not submitting.');
			return;
		}
		$.ajax({
			url: "krat_api.cgi", method: "POST", dataType: "json",
			headers: {
				"Authorization": "Bearer " + sessionStorage.getItem('jwt')
			},
			data: formdata, processData: false, contentType: false,
			success: function(result){ console.log(result); },
			error: function(e){}
		}).done(function(data) {
			if (data.status_code === 200) {
				$.notify(data.message);
				clear_close();
			} else {
				let msg = data.message + ' [status_code: ' + data.status_code + ']';
				$.notify(msg, {delay: 5000, type: 'danger'});
				clear_close();
			}
		}).fail(function($XHR, textStatus ) {
			let data = $XHR.responseJSON;
			if (data.message !== null) {
				let msg = "[Request failed] " + data.message;
				$.notify(msg, {delay: 5000, type: 'danger'});
			} else {
				console.log(textStatus);
			}
			clear_close();
		}).always(function() {
			$("#fb-notif #fb-notif-message").text('');
			$("#fb-notif").hide();
		});
	}, // submitFeedback()
	dataURItoBlob: function(dataURI) {
		// convert base64/URLEncoded data component to raw binary data held in
		// a string (https://stackoverflow.com/a/5100158/6951839)
		var byteString;
		if (dataURI.split(',')[0].indexOf('base64') >= 0)
			byteString = atob(dataURI.split(',')[1]);
		else
			byteString = decodeURI(dataURI.split(',')[1]);
		// separate out the mime component
		var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
		// write the bytes of the string to a typed array
		var ia = new Uint8Array(byteString.length);
		for (var i = 0; i < byteString.length; i++) {
			ia[i] = byteString.charCodeAt(i);
		}
		return new Blob([ia], {type:mimeString});
	}, // dataURItoBlob()
	queryBuilderTrigger: function () {
		$('#btn-special-query').on('click', function() {
			// console.log("in special query");
			$.confirm({
				title: "Query Builder",
				content: $('#html-templates').find('#modal-special-query').html(),
				columnClass: 'large',
				buttons: {
					enter: {
						text: 'Enter',
						btnClass: 'btn-blue',
						backgroundDismiss: true,
						action: function() {
							display.specialQuerySubmit(this.$content);
						}
					},
					cancel: function () {
						// close
					}
				}
			});
		});
	}, // queryBuilderTrigger
	revealAll: function () { // all tiers
		for (var elm in dp.visibility) {
			display.reveal(elm);
			dp.visibility[elm] = 1;
		}
	}, // revealAll()
	hide: function (what) { // a tier
		$("div,span,table").filter('.'+what).slideUp(500);
		dp.visibility[what] = 0;
		if (!(what in dp.visibility0)) {
			dp.visibility0[what] = 1;
		}
		// $( kind + "." + what ).slideUp(500);
	}, // hide()
	reveal: function(what) { // a tier
		$("div,span,table").filter('.'+what).slideDown(500, function() {
			$(this).effect("highlight", {}, 2500);
		});
		dp.visibility[what] = 1;
	}, // reveal()
	flip: function (attribute) {
		if (typeof dp.visibility[attribute] === 'undefined') {
			dp.visibility[attribute] = 1;
		}
		if (dp.visibility[attribute] === 1) { // hide it
			display.hide(attribute);
			display.makeColor('menu-' + attribute, '#FFD0D0');
		}  else { // reveal it
			display.reveal(attribute);
			display.makeColor('menu-' + attribute, '#A0FFA0');
		}
	}, // flip()
	loadVisibility: function () {
		// if visibility cookie exists, load dp.visibility with the cookie
		if (typeof Cookies.get('dp_visibility') !== 'undefined') {
			dp.visibility = Cookies.getJSON('dp_visibility');
		}
		Object.keys(dp.visibility).forEach(function(key) {
			if (dp.visibility[key] == 0) {
				display.hide(key);
			}
		});
	}, // loadVisibility()
	updateVisibilityCookie: function() {
		Cookies.set('dp_visibility', dp.visibility, { expires: 7 });
	}, // updateVisibilityCookie()
	makeColor: function (what, newColor) {
		if (!document.getElementById(what)) {
			// alert('no element called [' + what + ']');
			return; // hiding a field that doesn't apply to this result
		}
		document.getElementById(what).style.backgroundColor = newColor;
	}, // makeColor()
	dataToggle: function (me, what) { // from display.cgi
		var contents = $(me).parents(".rst-entry");
		contents.find(".rst-contents").hide();
		contents.find('.'+what).show();
	},  // dataToggle()
	toPNG: function (what) {
		// the following works at zoom=0, not so well at other zoom
		var contents = $(what).parents(".rst-entry")
							.find(".rst-contents").filter(":visible");
		var zoomLevel = 2.0;
		domtoimage.toPng(contents[0], {
			bgcolor : 'white',  // if you omit, you get "transparent"
			height : zoomLevel * (contents[0].scrollHeight + 100),
			width : zoomLevel * (contents[0].scrollWidth + 100),
			style : {
				'padding': '10px',
				'transform': 'scale(' + zoomLevel + ')',
				'transform-origin': 'top left',
			}
		}).then(function(dataUrl) {
			display.download(dataUrl, undefined, 'png');
		}).catch((err) => {
			console.log(err.message);
		});
	},  // toPNG()
	toText: function (what) {
		var node = $(what).parents(".rst-entry")
					 .find(".rst-contents").filter(":visible");
		var ret = display.makeText(node[0], 0).join('\n') + '\n';
		display.select(ret);
	},  // toText()
	makeText: function (what, level) {  // returns array of strings, stacked.
		// each element is intended to be on a new line.
		if (what === null) {
			return ['(empty)'];
		}
		var node = what;
		var nodeName = what.nodeName || 'NONAME';
		var answer;
		var theClass = what.attributes ?
			(what.attributes.class ? what.attributes.class.value : '') : '';
		if (nodeName == 'DIV') {
			return(display.gatherChildren(
				what, 1, display.makeText, level+1, undefined
			));
		} else if (nodeName === 'SPAN') {
			return([display.gatherChildren(
				what, 0, display.makeText, level+1, undefined
				).join('')
			]);
		} else if (nodeName === '#text') {
			if (! what.data.match(/\S/) ) {
				// return (["(blank)"]);
				return ([]);
			} else if (what.data.match(/🔊/)) {
				return (["(media symbol)"]);
			} else {
				return([what.data]);
			}
		} else if (nodeName == 'BR') { // completely ignore
			return ([]);
		} else if (nodeName == 'TABLE') { // introduced by setAlignment()
			if (what.className === 'tbl-prov') return;
			return([display.gatherChildren( // all children are TR nodes
				what, 0, display.makeText, level+1, undefined
				).join('\n')
			]);
		} else if (nodeName == 'TR') { // introduced by JavaScript to align
			answer = display.gatherChildren( // all children are TD nodes
				what, 0, display.makeText, level+1, undefined
				).join(' ');
			return([answer]);
		} else if (nodeName == 'TD') { // introduced by JavaScript to align
			return([display.gatherChildren( // all children are text nodes
				what, 0, display.makeText, level+1, undefined
				).join(' ')
			]);
		} else if (nodeName == 'svg' || nodeName == '#comment' ) {
			// ignore
			return([]);
		} else {
			alert('untreated node: ' + nodeName);
			return([]);
		}
	},  // makeText()
	merge: function (array1, array2, separator) {
		// do a pointwise concatenation (with a space) of array2 to the last
		// elements of array1.
		// separator is '&' or ' ' for LaTeX, undefined for text.
		var offset = array1.length - array2.length;
		var index;
		var answer = [];
		for (index = 0; index < offset; index += 1) { // copy array1
			answer[index] = array1[index] +
				(separator ? ' {} ' + separator : '');
		}
		var combineChar = separator ? separator : ' ';
		if (array1[offset].match(/[=-]$/)) {
			combineChar = array1[offset].substr(-1,1);
		} else if (array2[0].match(/^[=-]/)) {
			combineChar = array2[0].substr(0,1);
		}
		var thisCombine;
		for (index = 0; index < array2.length; index += 1) { // concat array2
			thisCombine =
				(array1[index+offset].substr(-1,1) === combineChar) ?  '' :
					(array2[index].substr(0,1) === combineChar) ? '' :
						combineChar;
			answer[index+offset] = array1[index+offset] + thisCombine +
				array2[index];
		}
		return answer;
	}, // merge()
	gatherChildren: function (node, onlyOdd, proc, extra, separator) {
		// call proc on each child of 'node' (maybe only odd children), with
		// extra param 'extra'.  separator is used for merge.
		// Return an array of results.
		var answer = [];
		var index;
		var children = node.childNodes;
		var child;
		var answerPart;
		var childName;
		var childClass;
		var prevKdiv = false;
		var curKdiv;
		for (index = 0; index < children.length; index += 1) {
			child = children[index];
			if (child.style && child.style.display === 'none') {
				continue;
			} // suppress invisible
			childName = child.nodeName || 'NONAME';
			if (onlyOdd && childName === '#text') {
				continue;
			}
			answerPart = proc(child, extra);
			childClass = (child.attributes && child.attributes.class) ?
				child.attributes.class.value : '';
			curKdiv = childName == 'DIV' && childClass == 'kdiv';
			if (prevKdiv && curKdiv) {
				// alert('Merging ' + answerPart.join(' , '));
				answer = display.merge(answer, answerPart, separator);
			} else {
				answer = answer.concat(answerPart);
			}
			prevKdiv = curKdiv;
		} // each child
		return answer;
	},  // gatherChildren()
	makeLatex: function (what, level) { // similar to making text.
		// each element is intended to be on a new line.
		if (what === null) {
			return ['(empty)'];
		}
		var node = what;
		var answer;
		var nodeName = what.nodeName || 'NONAME';
		var theClass = what.attributes ?
			(what.attributes.class ? what.attributes.class.value : '') : '';
		// console.log(level + ': ' + nodeName + ' class: ' + theClass);
		if (nodeName == 'DIV') {
			answer = display.gatherChildren(
				what, 1, display.makeLatex, level+1, ' & '
			);
			// console.log(answer);
			return(answer);
		} else if (nodeName === 'SPAN') {
			var prefix = '';
			var suffix = '';
			if (what.style.fontVariant === 'small-caps') {
				prefix = '\\textsc{';
				suffix = '}';
			}
			return([prefix +
				display.gatherChildren(
					what, 0, display.makeLatex, level+1, ' '
				).join('') +
				suffix]);
		} else if (nodeName === '#text') {
			if (! what.data.match(/\S/) ) {
				// console.log('empty text, level: ' + level);
				return (["~"]); // significant blank
			} else if (what.data.match(/🔊/)) {
				return ([]); // suppress media symbol
			} else { // escape LaTeX special characters
				return([what.data.
					replace(/\\/g,'\\textbackslash').
					replace(/~/g,'\\textasciitilde').
					replace(/\^/g,'\\textasciicircum').
					replace(/[&%$#_{}]/g, function(x){return '\\' + x;})
					]);
			}
		} else if (nodeName == 'BR') { // ignore
			return ([]);
		} else if (nodeName == 'TABLE') { // introduced by setAlignment()
			if (what.className === 'tbl-prov') return;
			return(display.gatherChildren( // all children are TR nodes
				what, 0, display.makeLatex, level+1, ' ')
			);
		} else if (nodeName == 'TR') { // introduced by JavaScript to align
			answer = display.gatherChildren( // all children are TD nodes
				what, 0, display.makeLatex, level+1, ' ').join(' & ');
			return([answer]);
		} else if (nodeName == 'TD') { // introduced by JavaScript to align
			answer = display.gatherChildren( // all children are text nodes
				what, 0, display.makeLatex, level+1, ' ').join('');
			return([answer]);
		} else {
			return ([nodeName]);
		}
	}, // makeLatex()
	fixLatexExp: function (lineArray) { // fixup for LaTeX, expex package
		var answer = [];
		var inTable = 0; // 0 is before, 1, 2, ... is inside, -1 is after
		var heldLines = []; // hold until after table
		answer.push('\\pex');
		lineArray.forEach(function (line) {
			var header = ['', '\\glpreamble ', '\\gla ', '\\glb ', '\\glc ', '\\glc ', '\\glc ',
			'\\glc ', '\\glc ', '\\glc ', '\\glc ' , '\\glc ', '\\glc '];
			if (line === undefined) return;
			// console.log(line);
			if (line.includes(' {}  & '.repeat(4)) && inTable === 0) {
				// not really a table start
				line = line.replace(/ {}  & /g, '');
				// console.log('removing, to get ' + line);
			}
			if (line.includes(' & ') && inTable === 0) {
				inTable = 1;
				answer.push("\\begingl");
				line = header[inTable] + line.replace(/ & /g, ' ') + ' //';
			} else if (inTable) {
				if (line.includes(' & ')) { // still in table
					inTable += 1;
					line = header[inTable] + line.replace(/ & /g, ' ') + ' //';
				} else { // moving out of table
					inTable = -1;
					answer.push("\\endgl \\\\");
				}
			} else {
				// line += ', '; // multiple initial lines 
			}
			if (inTable === 0) {
				heldLines.push(line);
			} else {
				answer.push(line);
			}
		});
		if (inTable > 0) {
			answer.push("\\endgl \\\\");
		}
		if (heldLines.length) {
			answer.push('(' + heldLines.join(', ') + ')');
		}
		answer.push("\\xe");
		return(answer);
	}, // fixLatexExp()
	fixLatexLinguex: function (lineArray) { // fixup for LaTeX, linguex package
		var answer = [];
		var inTable = 0; // 0 is before, 1, 2, ... is inside, -1 is after
		var heldLines = []; // hold until after table
		var tableLines = []; // hold until we know how many
		var afterLines = []; // lines after the table
		lineArray.forEach(function (line) {
			if (line === undefined) return;
			if (line.includes(' {}  & '.repeat(4)) && inTable === 0) {
				// not really a table start
				line = line.replace(/ {}  & /g, '');
				// console.log('removing, to get ' + line);
			}
			if (line.includes(' & ') && inTable === 0) {
				inTable = 1;
				line = line.replace(/ & /g, ' ') + ' \\\\';
			} else if (inTable > 0) {
				if (line.includes(' & ')) { // still in table
					inTable += 1;
					line = line.replace(/ & /g, ' ') + ' \\\\';
				} else { // moving out of table
					inTable = -1;
				}
			}
			if (inTable === 0) {
				heldLines.push(line);
			} else if (inTable > 0) {
				tableLines.push(line);
			} else { // after table
				afterLines.push(line);
			}
		});
		if (tableLines.length >= 4) {
			answer.push('\\ex. ' +
				tableLines.shift().replace(/{}/g,'').replace(/\\/g,'') + '\\glll ');
		} else if (tableLines.length === 3) {
			answer.push('\\exg. ' + tableLines.shift() + ' \\\\');
		} else {
			answer.push('% lines: ' + tableLines.length + '\\\\');
		}
		answer.push(tableLines.join('\n'));
		if (afterLines.length) {
			answer.push(afterLines.join('\n'));
		}
		if (heldLines.length) {
			answer.push('(' + heldLines.join(', ') + ') \\\\');
		}
		return(answer);
	}, // fixLatexLinguex()
	toLaTeX: function (what, how) {
		var node = $(what).parents(".rst-entry")
						.find(".rst-contents").filter(":visible")[0];
		// console.log(node);
		var contents = display.makeLatex(node, 1);
		contents = (how === 'pex') ? display.fixLatexExp(contents).join('\n') + '\n'
			: display.fixLatexLinguex(contents).join('\n') + '\n';
		// console.log(contents);
		display.select(contents);
	}, // toLaTeX()
	select: function (text) {
		// place the text in the selection buffer
		if (document.queryCommandSupported("copy")) {
			var node = document.createElement('textarea');
			// textarea preserves \n
			document.body.appendChild(node);
			node.innerHTML = text;
			node.select();
			// var range = document.createRange();
			// range.selectNode(node);
			// var selection = window.getSelection();
			// selection.removeAllRanges();
			// selection.addRange(range);
			document.execCommand("copy"); // to clipboard
			document.body.removeChild(node);
			var msg = "The result has been copied into the selection buffer.";
			$.notify(msg);
		} else {
			var msg = "This browser doesn't support copying to the selection" +
					  "buffer";
			$.notify(msg, {type: 'danger'})
		}
	}, // select()
	download: function (text, mime, extension) { // from toPNG
		var downloadLink = document.createElement("a");
		downloadLink.href = mime ?
			'data:' + mime + ',' + encodeURIComponent(text) :
			text;
		downloadLink.download = 'kratylos.' + extension;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
	}, // download()
	wantMore: function (direction) {
		display.updateProjectsOnRight();
		var input;
		var form = document.getElementById('myForm');
		var continuous =
			$("#myForm [name|=queryType]:checked").val() === undefined;
		display.addInputElt(form, 'wantMore', direction);
		var startAt;
		if (continuous) {
			var pageElt = document.getElementsByClassName('linear')[0];
			display.addInputElt(form, 'dataType',
				pageElt.getAttribute('data-type'));
			$("#myForm [name=queryType]").attr('checked', false);
			startAt = pageElt.firstElementChild.getAttribute('data-serial');
			display.addInputElt(form, 'queryType', 'continuous');
		} else {
			startAt = document.getElementById('firstShown').
				getAttribute('value');
		}
		var limit = document.getElementById('limit').value;
		// console.log('limit is ' + limit);
		$("#myForm #firstShown").val(startAt);
		var endAt = (parseInt(startAt) + parseInt(limit) - 1).toString();
		$("#myForm #lastShown").val(endAt);
		form.submit();
	}, // wantMore()
	setAlignment: function () { // from makeText
		var alignables = document.getElementsByClassName('align');
		var tokens, aIndex, tIndex, style, pIndex, trNode, tdNode,
			theParent, tableNode, divNode, thisSpan, thisClass;
		var attrs = ['title', 'data-elm-name', 'data-toggle', 'data-placement',
			'data-original-title'];
		for (aIndex = 0; aIndex < alignables.length; aIndex += 1) {
			// handle a span row
			thisSpan = alignables[aIndex];
			thisClass = thisSpan.className.replace(' align', '');
			if (theParent) { // not the first iteration
				if (thisSpan.parentNode !== theParent) { // new group
					theParent.appendChild(divNode);
					divNode = document.createElement('div');
					divNode.style.overflowX = 'auto';
					tableNode = document.createElement('table');
					divNode.appendChild(tableNode);
				}
			} else { // the first iteration
				divNode = document.createElement('div');
				divNode.style.overflowX = 'auto';
				tableNode = document.createElement('table');
				divNode.appendChild(tableNode);
			}
			theParent = thisSpan.parentNode;
			// establish a table row with the right properties and content
			trNode = document.createElement('tr');
			trNode.className = thisClass;
			for (pIndex = 0; pIndex < attrs.length; pIndex += 1) {
				trNode.setAttribute(attrs[pIndex],
					thisSpan.getAttribute(attrs[pIndex]));
			}
			tokens = thisSpan.innerHTML.
				replace(/<span /g, "<span"). // feather
				split(/ +/);
			for (tIndex = 0; tIndex < tokens.length; tIndex += 1) {
				tdNode = document.createElement('td');
				tdNode.style.paddingRight = '5px';
				tdNode.style.whiteSpace = 'nowrap';
				tdNode.innerHTML = tokens[tIndex].
					replace(//g, ' '); // unfeather
				trNode.appendChild(tdNode);
			} // each token
			tableNode.appendChild(trNode);
		} // each alignable
		if (theParent) theParent.appendChild(divNode);
		// remove the originals now, carefully.
		while (document.getElementsByClassName('align').length) {
			thisSpan = document.getElementsByClassName('align')[0];
			thisSpan.parentNode.removeChild(thisSpan);
		}
		// re-establish tooltips and context menus.
		$('[data-toggle="tooltip"]').tooltip();
		display.initContextMenu();
	}, // setAlignment()
	addInputElt: function(form, name, value) {
		var inputElt = document.createElement('input');
		inputElt.setAttribute('name', name);
		inputElt.setAttribute('id', name);
		inputElt.setAttribute('value', value);
		inputElt.setAttribute('type', 'hidden');
		form.appendChild(inputElt);
		// console.log(inputElt.getAttribute('name') + ': ' +
		// 	inputElt.getAttribute('value'));
	}, // addInputElt()
	toContinuous: function(elt, pid, type) {
		if (pid === undefined) { // called from display page, View Mode
			const theForm = document.createElement('form');
			document.body.appendChild(theForm);
			let pageElt;
			display.addInputElt(theForm, 'queryType', 'continuous');
			for (pageElt = elt; pageElt.className !== "row rst-entry";
					pageElt = pageElt.parentNode) {
				if (!pageElt.parentNode) return; // should never happen
			}
			pageElt = pageElt.firstElementChild.firstElementChild;
			display.addInputElt(theForm, 'serial',
				pageElt.getAttribute('data-serial'));
			display.addInputElt(theForm, 'firstShown',
				pageElt.getAttribute('data-serial'));
			display.addInputElt(theForm, 'project',
				pageElt.getAttribute('data-pid'));
			display.addInputElt(theForm, 'dataType',
				pageElt.getAttribute('data-type'));
			display.addInputElt(theForm, 'limit', 
				document.getElementById('limit').value);
			theForm.action = './display.cgi';
			theForm.method = 'post';
			theForm.submit();
		} else { // called via project:Read or display:Read (from start)
			if ($("#myForm").length === 0) { // initial project page
				// console.log("going to read " + pid + " type " + type);
				const theForm = document.createElement('form');
				document.body.appendChild(theForm);
				theForm.setAttribute('id', 'myForm');
				theForm.setAttribute('action', './display.cgi');
				theForm.setAttribute('target', '_blank');
				theForm.setAttribute('method', 'POST');
				display.addInputElt(theForm, 'query', '');
				display.addInputElt(theForm, 'firstShown', '');
				display.addInputElt(theForm, 'serial', '');
				display.addInputElt(theForm, 'limit', '');
				$.notify('The result is in a new tab');
			}
			$("#myForm #query").val('no query');
			$("#myForm [name=queryType]").attr('checked', false);
			$("#myForm #firstShown").val(1);
			$("#summarize").prop('checked', false);
			$("#myForm :input[name=project]").remove(); 
			$("#myForm").append('<input name="project" type="hidden" value="' + pid + '">');
			$("#myForm #serial").val(1);
			$("#myForm #limit").val(5);
			const form = document.getElementById('myForm');
			display.addInputElt(form, 'queryType', 'continuous');
			$("#myForm :input[name=dataType]").remove(); // previous value
			display.addInputElt(form, 'dataType', type);
			// console.log("dataType: " + type);
			form.submit();
			return;
		}
	}, // toContinuous()
	queryOnly: function(pid) { // from a summarization
		// console.log("queryOnly: " + pid);
		$("#summarize").prop('checked', false);
		var otherProjects = $("#myForm :input[name=project][value!=" + pid + "]");
		otherProjects.remove(); // only want this project to be searched
		display.newQuery(true); // new tab
		// revert to previous situation
		$("#myForm").append(otherProjects);
		$("#summarize").prop('checked', true);
		return false;
	}, // queryOnly()
	newQuery: function(newTab) {
		display.updateProjectsOnRight();
		// console.log("new query called");
		// if (!display.validateForm()) return false;
		$("#myForm #firstShown").val('1');
		$("#myForm #lastShown").val('0');
		// $("#myForm #bool_display_projects").val('0');
		if ($("#myForm [name|=queryType]:checked").val()=== undefined) {
			// alert("no queryType selected; asserting 'string'");
			$("#myForm #string").attr('checked', true);
		}
		if (newTab) {
			$.notify('The result is in a new tab');
			$("#myForm").prop('target', '_blank');
		} else {
			$("#myForm").prop('target', '_self');
		}
		$("#myForm").submit();
		return false; // prevent double-checking
	}, // newQuery()
	keyDownHandler: function(theEvent) {
		if (theEvent.keyCode == 13) {
			return display.newQuery(theEvent.ctrlKey || theEvent.metaKey);
		}
		return true;
	}, // keyDownHandler()
	sendFeedback: function(button) {
		var entry = $(button).parents(".rst-entry");
		var modal = $("#feedbackMsg");
		var infoNode = entry.find(".rst-contents");
		var collection_name = infoNode.attr('data-languageCollection') + ' (' +
			infoNode.attr('data-type') + ')';
		modal.find("#fb-coll").html(collection_name);
		modal.find("#fb-serial").html(infoNode.attr('data-serial'));
		dp.feedbackPointer = entry;
		modal.show();
	}, // sendFeedback()
	modifyEdited: function(theEvent) {
		theEvent.target.style.backgroundColor='#DFD';
		$("#modifyAccept").css('display', 'inline');
	},
	modifyAccept: function() {
		// user has made a modification. Accept it.
		display.elementToModify.html($("#modifyValue").val());
		display.elementToModify.effect("highlight", {}, 2500);
		display.elementToModify.parents(".rst-entry").
			find("[name=acceptMod]").css('display','inline');
		display.elementToModify.parents(".rst-entry").
			css("background-color", '#6DBDF2'); // to show it has changed
		$("#modifyEntry").modal('hide');
	},
	citation: function(who, how) {
		var date = new Date();
		var months = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];
		var project = $(who).parents(".rst-title").attr("data-project");
		var pid = $(who).parents(".rst-title").attr("data-pid");
		var ownerInfo = $(who).parents(".rst-title").attr("data-ownerInfo");
		var uploadInfo = $(who).parents(".rst-title").attr("data-uploadInfo");
		var webSite = $(who).parents(".rst-title").attr("data-webSite");
		var site = window.location.href.replace(/display.cgi.*/,'');
		var lines;
		if (how === 'bibTex') {
			lines = [
				"@inCollection{Kratylos" + date.getFullYear() + ",",
				"\tauthor={" + ownerInfo +"},",
				"\ttitle={" + project +"},",
				"\tbooktitle=" +
					"{Kratylos: Unified Linguistic Corpora from Diverse Data Sources},",
				"\tpublisher={\\url{www.kratylos.org/}},",
				"\tyear={" + uploadInfo +"},",
				"\teditor={Finkel, Raphael and Kaufman, Daniel},",
				"\tnote={" +
					(webSite !== '' ?
						'Uploaded from \\url{' + webSite + '}, ' : '') +
					"Accessed at \\url{" + site + "} on " +
					months[date.getMonth()] + ' ' +
					date.getDate() + ', ' +
					date.getFullYear() + "},",
				"}",
				""];
				display.select(lines.join("\n"));
		} else if (how === 'APA') {
			lines = [
				ownerInfo,
				"(" + uploadInfo + "),",
				(webSite !== '' ? 'uploaded from ' + webSite + ', ' : '') +
				project + ".",
				"In Finkel, R. and Kaufman, D.,",
				"Kratylos: Unified Linguistic Corpora from Diverse Data Sources.",
				"Uploaded",
				uploadInfo,
				"and retrieved from",
				site,
				"on",
				months[date.getMonth()], date.getDate(),
				date.getFullYear() + '.'
			];
			display.select(lines.join(" ") + "\n");
		} else if (how === 'URL') {
			let queryType = $("#myForm [name|=queryType]:checked").val();
			lines = [
				window.location.href.replace(/\?.*/,''),
				'?project=', pid,
			];
			if (queryType === undefined) { // continuous
				const pageElt = document.getElementsByClassName('linear')[0];
				const startAt =
					pageElt.firstElementChild.getAttribute('data-serial');
				lines.push(
					'&serial=', startAt,
					'&dataType=', $(".rst-contents").attr('data-type'),
					'&queryType=', 'continuous',
				);
			} else { // not continuous
				lines.push(
					'&query=', $("#myForm #query").val(),
					'&queryType=', queryType,
				);
			};
			display.select(lines.join('') + "\n");
		} else {
			display.select("internal error: style is " + how);
		}
	}, // citation()
	specialQuerySubmit: function($content) { // from queryBuilder
		let initial = $content.find("#specialQuery-initial").val();
		let avoid1 = $content.find("#specialQuery-avoid1").val();
		let finalValue = $content.find("#specialQuery-final").val();
		let avoid2 = $content.find("#specialQuery-avoid2").val();
		let avoid3 = $content.find("#specialQuery-avoid3").val();
		let pattern = [
			'(',
			initial,
			') ?',
		];
		if (avoid1 !== '') {
			pattern.push(
				'(?! ?(',
				avoid1,
				')) '
			);
		}
		if (avoid2 !== '') {
			pattern.push(
				'(?!((?!',
				finalValue,
				').)*?(',
				avoid2,
				') )'
			);
		}
		pattern.push(
			'((\\S+  ?)*?(',
			finalValue,
			'))'
		);
		if (avoid3 !== '') {
			pattern.push(
				' ?(?! ?(',
				avoid3,
				'))'
			);
		}
		let theQuery = pattern.join('');
		// console.log(theQuery);
		// alert(theQuery);
		$("#myForm #query").val(theQuery);
		$("#myForm [name=queryType]").attr('checked', false);
		$("#myForm #pattern").attr('checked', true);
		$("#modalSpecialQuery").modal('hide');
		const msg = "The new query is in the search bar.";
		$.notify(msg);
	}, // specialQuerySubmit()
	validateForm: function() {
		var msg = '';
		if ($("#myForm #query").val() == '') {
			msg = "The query field cannot be empty.";
		} else if ($("#txtSelLanguages").html() === '') {
			msg = "Select at least one project.";
		}
		if (msg !== '') {
			$.notify(msg, {type: 'danger'})
			return(false);
		}
		return(true);
	}, // validateForm()
	toggleAnnotation: function(entryId) {
		$("#annotation"+entryId).toggle("fast");
	}, // toggleAnnotation()
	showMap: function(latitude, longitude, eltId, span) {
		const elt = document.getElementById(eltId);
		const zoom = 5;
		if (elt.style.display !== 'block') { // start showing
			elt.style.display = 'block';
			if (!google.maps) {
				elt.innerHTML = "wait: map software is still loading...";
				return;
			}
			const pos = {lat: latitude, lng: longitude};
			const map = new google.maps.Map(elt,
				{center: pos, zoom: zoom, disableDefaultUI: true}
			);
			const marker = new google.maps.Marker(
				{position: pos, map: map, title: 'here'}
			);
		} else { // stop showing
			elt.style.display = 'none';
		}
	}, // showMap()
	// jQKeyboard.js interface
	startKeyboard: function(toModify) { // toModify is '#query' or #modifyValue
		if ($("#jQKeyboardContainer")) {
			$("#jQKeyboardContainer").remove();
		}
		let index;
		const width = 10; // wider than that we move to a new line
		// nonAscii is a global array defined in display.tmpl
		let pieces = [];
		for (index = 0; index < nonAscii.length; index += 1) {
			pieces.push([nonAscii[index], nonAscii[index], 0, 0,
				((index % width) === 0)]); // new line every 'width' buttons
		}
		pieces.push(
			['Clear', '46', 46, 3, true],
			['Close', '13', 13, 3, false]
		);
		activeInput = { // activeInput is a global in display.tmpl
			'htmlElem': '',
			'initValue': '',
			'keyboardLayout': { 'layout': [ [ pieces , pieces ] ] },
			'keyboardType': '0',
			'keyboardSet': 0,
			'dataType': 'string',
			'isMoney': false,
			'thousandsSep': ',',
			'disableKeyboardKey': false
		};
        $(toModify).initKeypad();
        $(toModify).trigger('click');
		const theKeyboard = $("#jQKeyboardContainer");
		if (toModify == '#modifyValue') {
			const theModal = $("#modifyEntry");
			theModal.append(theKeyboard);
			theModal.on('hidden.bs.modal', function () {
				// remove the keypad.
				const myEvent = jQuery.Event("keydown");
				myEvent.which = 27; // Close
				$(".jQKeyboardBtn[name=key13]").trigger(myEvent);
			});
		};
    }, // startKeyboard
	initScrollMore: function() { // establish a "more" at scroll near end
		if (screen.height > $(document).height()) {
			// short even before scrolling
			display.getMore();
		}
		$(window).scroll(function() {
			if($(window).scrollTop() + $(window).height() >
					$(document).height() - 500) {
				display.getMore();
			}
		});
	}, // initScrollMore
	haveWarned: 0,
	getMore: function() { // near bottom of page
		if (display.haveWarned) return; // only once
		display.haveWarned = 1;
		let results = $(".rst-contents.linear");
		let lastResult = results[results.length-1];
		let pid = lastResult.attributes['data-pid'].textContent;
		let startAt = parseInt(lastResult.attributes['data-serial'].textContent, 10);
		let dataType = lastResult.attributes['data-type'].textContent;
		// console.log("pid " + pid + "; start at sequence " + startAt);
		// console.log($(document).height());
		const header = sessionStorage.getItem('jwt') ?
			{'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')} : '';
		$.ajax({
			type: "GET", dataType: "json", url: "./krat_api.cgi",
			data: { endpoint: "/data/p/[pid]/more/[start]",
				pid: pid,
				startAt: startAt,
				dataType: dataType
			},
			headers: header,
		}).done( function(msg) {
			// console.log("get more succeeded: " + msg.message);
			$("#insert-here").before(msg.message);
			display.haveWarned = 0; // can get more now
			// console.log($(document).height());
			display.initScrollMore();
			// hide any tiers that should be hidden
			let index;
			let keys = Object.keys(dp.visibility);
			for (index = 0; index < keys.length; index += 1) {
				let key = keys[index];
				// console.log("visibility of " + key + " is " + dp.visibility[key]);
				if (dp.visibility[key] === 0) { // hide it
					display.hide(key);
				}
			} // each index
		}).fail(function (header, textStatus) {
			let data = header.responseJSON || textStatus;
			// console.log("get more failed: " + data.message);
			if (data.message && data.message.match(/re-login/)) {
				alertify.alert('Try logging in again');
			} else {	
				alertify.notify(textStatus || 'unknown error', 'error', 5);
			}
		});
	}, // getMore
	toggleCollections: function(elt) {
		let collectionSpan = $("#collections");
		console.log(elt);
		if (elt.innerHTML === 'hide') {
			elt.innerHTML = 'show';
			// elt.setAttribute('data-original-title', 'display collections');
			collectionSpan.slideUp(500);
		} else {
			elt.innerHTML = 'hide';
			// elt.setAttribute('data-original-title', 'hide collections');
			collectionSpan.slideDown(500);
		}
		return 0;
	}, // toggleCollections
	toggleProject: function(elt) {
		if (elt.className === 'projectName') {
			elt.className = 'projectNameInactive';
			// $("form#myForm input[name='project'] value='THISPID'").  // inactivate
		} else {
			elt.className = 'projectName';
			// $("form#myForm input[name='project'] value='THISPID'").  // activate
		}
	}, 
	dom2json: function(elt, level) { // convert DOM object to json
		let nodeName = elt.nodeName;
		let elmName = elt.dataset.elmName ? elt.dataset.elmName.replace(/[^_]*_/,'') : 'noName';
		let pad = '  '.repeat(level == 0 ? 0 : level-1);
		if (nodeName == 'SPAN') {
			if (elt.innerText.match(/^\s*$/)) {
				// ignore effectively empty fields
				return '';
			} else {
				var content = elt.innerHTML.replace(
					/<span style=\"font-variant:small-caps\">(\w+)<\/span>/g,
					function (match, word) {
						return word.toUpperCase();
					}
				).replace(
					/<span class=\"result\">(.*)<\/span>/g,
					'$1'
				);
				return pad + elmName + ' = "' + content + '"\n';
			}
		} else if (nodeName == 'DIV') {
			const children = elt.childNodes;
			if (children.length == 0) return '';
			let answer = (level == 0) ? '' : pad + elmName + ' (\n';
			const firstIndex = (level == 0 ? 3 : 1);
			for (let index = firstIndex; index < children.length; index += 2) {
				const child = children[index];
				const toPush = display.dom2json(child, level+1);
				if (toPush.length) { // only if we get something
					answer += toPush;
				}
			}
			answer += (level == 0) ? '' : pad + ")\n";
			return answer;
		} else {
			return '';
		}
	}, // dom2json
	entry2json: function(elt) { // convert an rst-entry to json
		// for now, ignore elt; just choose the first rst-entry
		// const entry = $(elt);
		var theElt;
		if (elt) {
			theElt = $(elt).parents(".rst-entry")[0];
		} else {
			theElt = $(".rst-entry")[0]; // DOM 
		}
		const header = $(theElt).find(".linear");
		const projectPath = header.attr('data-projectpath');
		const pid = header.attr('data-pid');
		const serial = header.attr('data-serial');
		const dataType = header.attr('data-type');
		const result = display.dom2json(header[0], 0);
		if (!sessionStorage.getItem('jwt')) {
			$.notify('You don\'t seem logged in; not modifying.');
			return;
		}
		// console.log(result);
		// display.select(result);
		$.ajax({
			type: "POST", dataType: "json", url: "./krat_api.cgi",
			data: {
				endpoint: "PUT/modify/[pid]/[type]/[serial]",
				pid: pid,
				projectPath: projectPath,
				dataType: dataType,
				serial: serial,
				data: result,
			},
			headers: {
				'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')
			},
		}).done( function(msg) {
			$.notify(msg.message);
		}).fail(function (jqXHR, textStatus) {
			$.notify("AJAX call failed.", 'error');
			console.log("POST PUT/modify/[pid]/[type]/[serial] failed: " + textStatus);
		});
		header.parent().find("[name=acceptMod]").css('display','none');
		header.parents(".rst-entry").css("background-color", '');
	}, // entry2json
}; // display

/*
 * Media Player using Plyr (https://github.com/sampotts/plyr)
 * Originally using version 2.0.18.
 * 1/27/2019: using version 3.4.8; new versions require slight reworking of the
 * code.
 */
var mediaPlayer = {
	audioPlayer: null,
	videoPlayer: null,
	audioControls: null,
	videoControls: null,
	span: [0, 0],
	playerSettings: { debug: false, preload: 'metadata'},
	init: function() { // initialize the players (audio and video)
		// plyr is already initialized as new Plyr by version 2.0.18
		mediaPlayer.audioPlayer = new Plyr($('#audio-player')[0],
			mediaPlayer.playerSettings);
		mediaPlayer.audioControls = $("#audio-layer");
		mediaPlayer.videoPlayer = new Plyr($('#video-player')[0],
			mediaPlayer.playerSettings);
		mediaPlayer.videoControls = $("#video-layer");
		mediaPlayer.audioPlayer.on('ended', function (e) {
			// console.log('audio player: ended');
			mediaPlayer.audioControls.hide();
		});
	}, // init()
	isSourceSame: function(src, type, media_elm) {
		// type is audio or video
		const srcLoaded = mediaPlayer[type + 'Player'].source;
		// console.log("srcLoaded: "); console.log(srcLoaded);
		const idxTimeFrame = srcLoaded.indexOf('#t=');
		if (idxTimeFrame > 0) {
			return (srcLoaded.substr(0, idxTimeFrame).endsWith(src));
		} else {
			return (srcLoaded.endsWith(src));
		}
	}, // isSourceSame()
	playIt: function(src, elm, start, length, mediaType) {
		// mediaType is audio or video
		// console.log("media type is " + mediaType);
		const controls = mediaPlayer[mediaType + 'Controls'];	
		if (controls.css('display') === 'none') {
			controls.show('slide', { direction: 'down' }, 1000, function() {
				mediaPlayer.playIt(src, elm, start, length, mediaType);
			});
			return;
		}
		const player = mediaPlayer[mediaType + 'Player'];
		// time in seconds
		start = parseFloat(start / 1000);
		length = parseFloat(length / 1000) + 0.2; // extend a bit
		let end = (start + length);
		mediaPlayer.span = [start, end];
		// let waiting = mediaPlayer.changeSource(src);
		let options = {
			type: mediaType,
			sources: [{ src: src+'#t='+start+','+end, type:mediaType + '/ogg' }],
		}
		player.source = options;
		// console.log("setting source options to "); console.log(options);
		player.play();
	}, // playIt()
}; // mediaPlayer

var Notifier = (function () {
	"use strict";
	var elem, hideHandler, that = {};
	that.init = function (options) {
		elem = $(options.selector);
	};
	that.show = function (text) {
		clearTimeout(hideHandler);
		elem.find("span").html(text);
		elem.delay(200).fadeIn().delay(4000).fadeOut();
	};
	that.info = function (text) {
		this.show(elem.class);
	};
	that.error = function (text) {
		elem.addClass('error');
		this.show(text);
	};
	return that;
}());

// google analytics
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
		(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
ga('create', 'UA-93167051-1', 'auto');
ga('send', 'pageview');

/**
 * [js-sha256]{@link https://github.com/emn178/js-sha256}
 *
 * @version 0.7.1
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */
/*jslint bitwise: true */
(function () {
	'use strict';

	var ERROR = 'input is invalid type';
	var root = typeof window === 'object' ? window : {};
	var NODE_JS = !root.JS_SHA256_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node;
	if (NODE_JS) {
		root = global;
	}
	var COMMON_JS = !root.JS_SHA256_NO_COMMON_JS && typeof module === 'object' && module.exports;
	var AMD = typeof define === 'function' && define.amd;
	var ARRAY_BUFFER = typeof ArrayBuffer !== 'undefined';
	var HEX_CHARS = '0123456789abcdef'.split('');
	var EXTRA = [-2147483648, 8388608, 32768, 128];
	var SHIFT = [24, 16, 8, 0];
	var K = [
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	];
	var OUTPUT_TYPES = ['hex', 'array', 'digest', 'arrayBuffer'];

	var blocks = [];

	if (root.JS_SHA256_NO_NODE_JS || !Array.isArray) {
		Array.isArray = function (obj) {
			return Object.prototype.toString.call(obj) === '[object Array]';
		};
	}

	var createOutputMethod = function (outputType, is224) {
		return function (message) {
			return new Sha256(is224, true).update(message)[outputType]();
		};
	};

	var createMethod = function (is224) {
		var method = createOutputMethod('hex', is224);
		if (NODE_JS) {
			method = nodeWrap(method, is224);
		}
		method.create = function () {
			return new Sha256(is224);
		};
		method.update = function (message) {
			return method.create().update(message);
		};
		for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
			var type = OUTPUT_TYPES[i];
			method[type] = createOutputMethod(type, is224);
		}
		return method;
	};

	var nodeWrap = function (method, is224) {
		var crypto = require('crypto');
		var Buffer = require('buffer').Buffer;
		var algorithm = is224 ? 'sha224' : 'sha256';
		var nodeMethod = function (message) {
			if (typeof message === 'string') {
				return crypto.createHash(algorithm).update(message, 'utf8').digest('hex');
			} else {
				if (message === null || message === undefined) {
					throw ERROR;
				} else if (message.constructor === ArrayBuffer) {
					message = new Uint8Array(message);
				}
			}
			if (Array.isArray(message) || ArrayBuffer.isView(message) ||
				message.constructor === Buffer) {
				return crypto.createHash(algorithm).update(new Buffer(message)).digest('hex');
			} else {
				return method(message);
			}
		};
		return nodeMethod;
	};

	var createHmacOutputMethod = function (outputType, is224) {
		return function (key, message) {
			return new HmacSha256(key, is224, true).update(message)[outputType]();
		};
	};

	var createHmacMethod = function (is224) {
		var method = createHmacOutputMethod('hex', is224);
		method.create = function (key) {
			return new HmacSha256(key, is224);
		};
		method.update = function (key, message) {
			return method.create(key).update(message);
		};
		for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
			var type = OUTPUT_TYPES[i];
			method[type] = createHmacOutputMethod(type, is224);
		}
		return method;
	};

	function Sha256(is224, sharedMemory) {
		if (sharedMemory) {
			blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] =
				blocks[4] = blocks[5] = blocks[6] = blocks[7] =
					blocks[8] = blocks[9] = blocks[10] = blocks[11] =
						blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
			this.blocks = blocks;
		} else {
			this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		}

		if (is224) {
			this.h0 = 0xc1059ed8;
			this.h1 = 0x367cd507;
			this.h2 = 0x3070dd17;
			this.h3 = 0xf70e5939;
			this.h4 = 0xffc00b31;
			this.h5 = 0x68581511;
			this.h6 = 0x64f98fa7;
			this.h7 = 0xbefa4fa4;
		} else { // 256
			this.h0 = 0x6a09e667;
			this.h1 = 0xbb67ae85;
			this.h2 = 0x3c6ef372;
			this.h3 = 0xa54ff53a;
			this.h4 = 0x510e527f;
			this.h5 = 0x9b05688c;
			this.h6 = 0x1f83d9ab;
			this.h7 = 0x5be0cd19;
		}

		this.block = this.start = this.bytes = this.hBytes = 0;
		this.finalized = this.hashed = false;
		this.first = true;
		this.is224 = is224;
	}

	Sha256.prototype.update = function (message) {
		if (this.finalized) {
			return;
		}
		var notString = typeof message !== 'string';
		if (notString) {
			if (message === null || message === undefined) {
				throw ERROR;
			} else if (message.constructor === root.ArrayBuffer) {
				message = new Uint8Array(message);
			}
		}
		var length = message.length;
		if (notString) {
			if (typeof length !== 'number' ||
				!Array.isArray(message) &&
				!(ARRAY_BUFFER && ArrayBuffer.isView(message))) {
				throw ERROR;
			}
		}
		var code, index = 0, i, blocks = this.blocks;

		while (index < length) {
			if (this.hashed) {
				this.hashed = false;
				blocks[0] = this.block;
				blocks[16] = blocks[1] = blocks[2] = blocks[3] =
					blocks[4] = blocks[5] = blocks[6] = blocks[7] =
						blocks[8] = blocks[9] = blocks[10] = blocks[11] =
							blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
			}

			if (notString) {
				for (i = this.start; index < length && i < 64; ++index) {
					blocks[i >> 2] |= message[index] << SHIFT[i++ & 3];
				}
			} else {
				for (i = this.start; index < length && i < 64; ++index) {
					code = message.charCodeAt(index);
					if (code < 0x80) {
						blocks[i >> 2] |= code << SHIFT[i++ & 3];
					} else if (code < 0x800) {
						blocks[i >> 2] |= (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
						blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
					} else if (code < 0xd800 || code >= 0xe000) {
						blocks[i >> 2] |= (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
						blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
						blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
					} else {
						code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
						blocks[i >> 2] |= (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
						blocks[i >> 2] |= (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
						blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
						blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
					}
				}
			}

			this.lastByteIndex = i;
			this.bytes += i - this.start;
			if (i >= 64) {
				this.block = blocks[16];
				this.start = i - 64;
				this.hash();
				this.hashed = true;
			} else {
				this.start = i;
			}
		}
		if (this.bytes > 4294967295) {
			this.hBytes += this.bytes / 4294967296 << 0;
			this.bytes = this.bytes % 4294967296;
		}
		return this;
	};

	Sha256.prototype.finalize = function () {
		if (this.finalized) {
			return;
		}
		this.finalized = true;
		var blocks = this.blocks, i = this.lastByteIndex;
		blocks[16] = this.block;
		blocks[i >> 2] |= EXTRA[i & 3];
		this.block = blocks[16];
		if (i >= 56) {
			if (!this.hashed) {
				this.hash();
			}
			blocks[0] = this.block;
			blocks[16] = blocks[1] = blocks[2] = blocks[3] =
				blocks[4] = blocks[5] = blocks[6] = blocks[7] =
					blocks[8] = blocks[9] = blocks[10] = blocks[11] =
						blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
		}
		blocks[14] = this.hBytes << 3 | this.bytes >> 29;
		blocks[15] = this.bytes << 3;
		this.hash();
	};

	Sha256.prototype.hash = function () {
		var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4, f = this.h5, g = this.h6,
			h = this.h7, blocks = this.blocks, j, s0, s1, maj, t1, t2, ch, ab, da, cd, bc;

		for (j = 16; j < 64; ++j) {
			// rightrotate
			t1 = blocks[j - 15];
			s0 = ((t1 >>> 7) | (t1 << 25)) ^ ((t1 >>> 18) | (t1 << 14)) ^ (t1 >>> 3);
			t1 = blocks[j - 2];
			s1 = ((t1 >>> 17) | (t1 << 15)) ^ ((t1 >>> 19) | (t1 << 13)) ^ (t1 >>> 10);
			blocks[j] = blocks[j - 16] + s0 + blocks[j - 7] + s1 << 0;
		}

		bc = b & c;
		for (j = 0; j < 64; j += 4) {
			if (this.first) {
				if (this.is224) {
					ab = 300032;
					t1 = blocks[0] - 1413257819;
					h = t1 - 150054599 << 0;
					d = t1 + 24177077 << 0;
				} else {
					ab = 704751109;
					t1 = blocks[0] - 210244248;
					h = t1 - 1521486534 << 0;
					d = t1 + 143694565 << 0;
				}
				this.first = false;
			} else {
				s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
				s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
				ab = a & b;
				maj = ab ^ (a & c) ^ bc;
				ch = (e & f) ^ (~e & g);
				t1 = h + s1 + ch + K[j] + blocks[j];
				t2 = s0 + maj;
				h = d + t1 << 0;
				d = t1 + t2 << 0;
			}
			s0 = ((d >>> 2) | (d << 30)) ^ ((d >>> 13) | (d << 19)) ^ ((d >>> 22) | (d << 10));
			s1 = ((h >>> 6) | (h << 26)) ^ ((h >>> 11) | (h << 21)) ^ ((h >>> 25) | (h << 7));
			da = d & a;
			maj = da ^ (d & b) ^ ab;
			ch = (h & e) ^ (~h & f);
			t1 = g + s1 + ch + K[j + 1] + blocks[j + 1];
			t2 = s0 + maj;
			g = c + t1 << 0;
			c = t1 + t2 << 0;
			s0 = ((c >>> 2) | (c << 30)) ^ ((c >>> 13) | (c << 19)) ^ ((c >>> 22) | (c << 10));
			s1 = ((g >>> 6) | (g << 26)) ^ ((g >>> 11) | (g << 21)) ^ ((g >>> 25) | (g << 7));
			cd = c & d;
			maj = cd ^ (c & a) ^ da;
			ch = (g & h) ^ (~g & e);
			t1 = f + s1 + ch + K[j + 2] + blocks[j + 2];
			t2 = s0 + maj;
			f = b + t1 << 0;
			b = t1 + t2 << 0;
			s0 = ((b >>> 2) | (b << 30)) ^ ((b >>> 13) | (b << 19)) ^ ((b >>> 22) | (b << 10));
			s1 = ((f >>> 6) | (f << 26)) ^ ((f >>> 11) | (f << 21)) ^ ((f >>> 25) | (f << 7));
			bc = b & c;
			maj = bc ^ (b & d) ^ cd;
			ch = (f & g) ^ (~f & h);
			t1 = e + s1 + ch + K[j + 3] + blocks[j + 3];
			t2 = s0 + maj;
			e = a + t1 << 0;
			a = t1 + t2 << 0;
		}

		this.h0 = this.h0 + a << 0;
		this.h1 = this.h1 + b << 0;
		this.h2 = this.h2 + c << 0;
		this.h3 = this.h3 + d << 0;
		this.h4 = this.h4 + e << 0;
		this.h5 = this.h5 + f << 0;
		this.h6 = this.h6 + g << 0;
		this.h7 = this.h7 + h << 0;
	};

	Sha256.prototype.hex = function () {
		this.finalize();

		var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5,
			h6 = this.h6, h7 = this.h7;

		var hex = HEX_CHARS[(h0 >> 28) & 0x0F] + HEX_CHARS[(h0 >> 24) & 0x0F] +
			HEX_CHARS[(h0 >> 20) & 0x0F] + HEX_CHARS[(h0 >> 16) & 0x0F] +
			HEX_CHARS[(h0 >> 12) & 0x0F] + HEX_CHARS[(h0 >> 8) & 0x0F] +
			HEX_CHARS[(h0 >> 4) & 0x0F] + HEX_CHARS[h0 & 0x0F] +
			HEX_CHARS[(h1 >> 28) & 0x0F] + HEX_CHARS[(h1 >> 24) & 0x0F] +
			HEX_CHARS[(h1 >> 20) & 0x0F] + HEX_CHARS[(h1 >> 16) & 0x0F] +
			HEX_CHARS[(h1 >> 12) & 0x0F] + HEX_CHARS[(h1 >> 8) & 0x0F] +
			HEX_CHARS[(h1 >> 4) & 0x0F] + HEX_CHARS[h1 & 0x0F] +
			HEX_CHARS[(h2 >> 28) & 0x0F] + HEX_CHARS[(h2 >> 24) & 0x0F] +
			HEX_CHARS[(h2 >> 20) & 0x0F] + HEX_CHARS[(h2 >> 16) & 0x0F] +
			HEX_CHARS[(h2 >> 12) & 0x0F] + HEX_CHARS[(h2 >> 8) & 0x0F] +
			HEX_CHARS[(h2 >> 4) & 0x0F] + HEX_CHARS[h2 & 0x0F] +
			HEX_CHARS[(h3 >> 28) & 0x0F] + HEX_CHARS[(h3 >> 24) & 0x0F] +
			HEX_CHARS[(h3 >> 20) & 0x0F] + HEX_CHARS[(h3 >> 16) & 0x0F] +
			HEX_CHARS[(h3 >> 12) & 0x0F] + HEX_CHARS[(h3 >> 8) & 0x0F] +
			HEX_CHARS[(h3 >> 4) & 0x0F] + HEX_CHARS[h3 & 0x0F] +
			HEX_CHARS[(h4 >> 28) & 0x0F] + HEX_CHARS[(h4 >> 24) & 0x0F] +
			HEX_CHARS[(h4 >> 20) & 0x0F] + HEX_CHARS[(h4 >> 16) & 0x0F] +
			HEX_CHARS[(h4 >> 12) & 0x0F] + HEX_CHARS[(h4 >> 8) & 0x0F] +
			HEX_CHARS[(h4 >> 4) & 0x0F] + HEX_CHARS[h4 & 0x0F] +
			HEX_CHARS[(h5 >> 28) & 0x0F] + HEX_CHARS[(h5 >> 24) & 0x0F] +
			HEX_CHARS[(h5 >> 20) & 0x0F] + HEX_CHARS[(h5 >> 16) & 0x0F] +
			HEX_CHARS[(h5 >> 12) & 0x0F] + HEX_CHARS[(h5 >> 8) & 0x0F] +
			HEX_CHARS[(h5 >> 4) & 0x0F] + HEX_CHARS[h5 & 0x0F] +
			HEX_CHARS[(h6 >> 28) & 0x0F] + HEX_CHARS[(h6 >> 24) & 0x0F] +
			HEX_CHARS[(h6 >> 20) & 0x0F] + HEX_CHARS[(h6 >> 16) & 0x0F] +
			HEX_CHARS[(h6 >> 12) & 0x0F] + HEX_CHARS[(h6 >> 8) & 0x0F] +
			HEX_CHARS[(h6 >> 4) & 0x0F] + HEX_CHARS[h6 & 0x0F];
		if (!this.is224) {
			hex += HEX_CHARS[(h7 >> 28) & 0x0F] + HEX_CHARS[(h7 >> 24) & 0x0F] +
				HEX_CHARS[(h7 >> 20) & 0x0F] + HEX_CHARS[(h7 >> 16) & 0x0F] +
				HEX_CHARS[(h7 >> 12) & 0x0F] + HEX_CHARS[(h7 >> 8) & 0x0F] +
				HEX_CHARS[(h7 >> 4) & 0x0F] + HEX_CHARS[h7 & 0x0F];
		}
		return hex;
	};

	Sha256.prototype.toString = Sha256.prototype.hex;

	Sha256.prototype.digest = function () {
		this.finalize();

		var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5,
			h6 = this.h6, h7 = this.h7;

		var arr = [
			(h0 >> 24) & 0xFF, (h0 >> 16) & 0xFF, (h0 >> 8) & 0xFF, h0 & 0xFF,
			(h1 >> 24) & 0xFF, (h1 >> 16) & 0xFF, (h1 >> 8) & 0xFF, h1 & 0xFF,
			(h2 >> 24) & 0xFF, (h2 >> 16) & 0xFF, (h2 >> 8) & 0xFF, h2 & 0xFF,
			(h3 >> 24) & 0xFF, (h3 >> 16) & 0xFF, (h3 >> 8) & 0xFF, h3 & 0xFF,
			(h4 >> 24) & 0xFF, (h4 >> 16) & 0xFF, (h4 >> 8) & 0xFF, h4 & 0xFF,
			(h5 >> 24) & 0xFF, (h5 >> 16) & 0xFF, (h5 >> 8) & 0xFF, h5 & 0xFF,
			(h6 >> 24) & 0xFF, (h6 >> 16) & 0xFF, (h6 >> 8) & 0xFF, h6 & 0xFF
		];
		if (!this.is224) {
			arr.push((h7 >> 24) & 0xFF, (h7 >> 16) & 0xFF, (h7 >> 8) & 0xFF, h7 & 0xFF);
		}
		return arr;
	};

	Sha256.prototype.array = Sha256.prototype.digest;

	Sha256.prototype.arrayBuffer = function () {
		this.finalize();

		var buffer = new ArrayBuffer(this.is224 ? 28 : 32);
		var dataView = new DataView(buffer);
		dataView.setUint32(0, this.h0);
		dataView.setUint32(4, this.h1);
		dataView.setUint32(8, this.h2);
		dataView.setUint32(12, this.h3);
		dataView.setUint32(16, this.h4);
		dataView.setUint32(20, this.h5);
		dataView.setUint32(24, this.h6);
		if (!this.is224) {
			dataView.setUint32(28, this.h7);
		}
		return buffer;
	};

	function HmacSha256(key, is224, sharedMemory) {
		var notString = typeof key !== 'string';
		if (notString) {
			if (key === null || key === undefined) {
				throw ERROR;
			} else if (key.constructor === root.ArrayBuffer) {
				key = new Uint8Array(key);
			}
		}
		var length = key.length;
		if (notString) {
			if (typeof length !== 'number' ||
				!Array.isArray(key) &&
				!(ARRAY_BUFFER && ArrayBuffer.isView(key))) {
				throw ERROR;
			}
		} else {
			var bytes = [], length = key.length, index = 0, code;
			for (var i = 0; i < length; ++i) {
				code = key.charCodeAt(i);
				if (code < 0x80) {
					bytes[index++] = code;
				} else if (code < 0x800) {
					bytes[index++] = (0xc0 | (code >> 6));
					bytes[index++] = (0x80 | (code & 0x3f));
				} else if (code < 0xd800 || code >= 0xe000) {
					bytes[index++] = (0xe0 | (code >> 12));
					bytes[index++] = (0x80 | ((code >> 6) & 0x3f));
					bytes[index++] = (0x80 | (code & 0x3f));
				} else {
					code = 0x10000 + (((code & 0x3ff) << 10) | (key.charCodeAt(++i) & 0x3ff));
					bytes[index++] = (0xf0 | (code >> 18));
					bytes[index++] = (0x80 | ((code >> 12) & 0x3f));
					bytes[index++] = (0x80 | ((code >> 6) & 0x3f));
					bytes[index++] = (0x80 | (code & 0x3f));
				}
			}
			key = bytes;
		}

		if (key.length > 64) {
			key = (new Sha256(is224, true)).update(key).array();
		}

		var oKeyPad = [], iKeyPad = [];
		for (var i = 0; i < 64; ++i) {
			var b = key[i] || 0;
			oKeyPad[i] = 0x5c ^ b;
			iKeyPad[i] = 0x36 ^ b;
		}

		Sha256.call(this, is224, sharedMemory);

		this.update(iKeyPad);
		this.oKeyPad = oKeyPad;
		this.inner = true;
		this.sharedMemory = sharedMemory;
	}
	HmacSha256.prototype = new Sha256();

	HmacSha256.prototype.finalize = function () {
		Sha256.prototype.finalize.call(this);
		if (this.inner) {
			this.inner = false;
			var innerHash = this.array();
			Sha256.call(this, this.is224, this.sharedMemory);
			this.update(this.oKeyPad);
			this.update(innerHash);
			Sha256.prototype.finalize.call(this);
		}
	};

	var exports = createMethod();
	exports.sha256 = exports;
	exports.sha224 = createMethod(true);
	exports.sha256.hmac = createHmacMethod();
	exports.sha224.hmac = createHmacMethod(true);

	if (COMMON_JS) {
		module.exports = exports;
	} else {
		root.sha256 = exports.sha256;
		root.sha224 = exports.sha224;
		if (AMD) {
			define(function () {
				return exports;
			});
		}
	}
})();
/* Sha256 class ends here ---------------------------------------------------- */
