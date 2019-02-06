$(document).ready(function(){

	//When page is loading
	$('.scoreitem:first').addClass('selectedmenu');
	$('.content').hide();
	$('.content:first').show();
	var score_name = $.trim($('.content:first').attr('name').replace('_content',''));
	var doc_name = score_name + "_doc";
	$("[name='document']").hide();
	if($("[name='" + doc_name + "']").length){
		var height_score = $("[name='score']:first").height();
		$("[name='" + doc_name + "']").parent().height(height_score);
		$("[name='document']").find('.docsection').hide();
		$("[name='" + doc_name + "']").parent().show();
		$("[name='" + doc_name + "']").show();
	}

	//On line/score click, show the associated doc and highlight the line
	$('.line').click(function(event){
		$('.line').removeClass('selectedScore');
        $('.leaf').removeClass('selectedScore');
		$('.payload').removeClass('selectedScore');
    	$(this).addClass('selectedScore');
        $(this).find('.leaf').addClass('selectedScore');
		$(this).find('.payload').addClass('selectedScore');

        var element_name = $.trim($(this).find('.leaf').text()) + '_doc';
		$("[name='document']").hide();
		if ($(this).closest('.row').find("[name='document']").find("[name='" + element_name + "']").length) {
			$("[name='document']").show();
	        $("[name='document']").find('.docsection').hide();
			height_score = $(this).parent().height();
			$("[name='document']").height(height_score);
	        $("[name='document']").find("[name='" + element_name + "']").show();
		}

	});

	//On score in the menu click, show the associated page content
	$('.scoreitem').click(function(event){
		$('.scoreitem').removeClass('selectedmenu');
    	$(this).addClass('selectedmenu');

        var content_name = $.trim($(this).attr('name')) + '_content';
		var doc_name = content_name.replace('_content', '_doc');

        $('.content').hide();
        $("[name='" + content_name + "']").show();
		$(this).closest('body').find("[name='document']").hide();
		if ($(this).closest('body').find("[name='" + doc_name + "']").length) {
			height_score = $(this).closest('body').find(".content[name='" + content_name + "']").find('.scorepane').height();
			$(this).closest('body').find("[name='" + content_name + "']").find("[name='document']").show();
			$(this).closest('body').find("[name='" + content_name + "']").find("[name='document']").height(height_score);
		}
	});

	$('.actremote').click(function(event){

		var device_uid = $(this).attr('device_uid');
		var remote_uid = $(this).attr('remote_uid');
		var xhttp1 = new XMLHttpRequest();
		xhttp1.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				alert(xhttp1.responseText);
			}
		};
		xhttp1.open("GET", "/act/" + device_uid + "/" + remote_uid, true);
		xhttp1.send();
	});

	$(document).click(function(event) {
		if (!$(event.target).closest('.line').length && !$(event.target).closest("[name='document']").length) {
			$('.line').removeClass('selectedScore');
			$('.leaf').removeClass('selectedScore');
			$('.payload').removeClass('selectedScore');
			var content_name = $.trim($('.selectedmenu').attr('name')) + "_content";
			if (content_name == '_content') {
				content_name = $.trim($('.content').attr('name'));
			}
			var doc_name = content_name.replace('_content', '_doc');
			$("[name='document']").hide();
			if ($("[name='" + doc_name + "']").length) {
				var height_score = $(".content[name='" + content_name + "']").find('.scorepane').height();
				$("[name='" + doc_name + "']").parent().height(height_score);
				$("[name='document']").find('.docsection').hide();
				$("[name='" + doc_name + "']").parent().show();
				$("[name='" + doc_name + "']").show();
			}
		}
	});
});
