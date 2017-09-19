$('.textarea > button').click(function() {
  	text=$.trim($("textarea").val())
    if (text != "") {
    	if($( ".model option:selected" ).text() === "Default"){
    		model="";
    	} else {
    		model=$(".model option:selected").text();
    	}
			$.post('/api/upload-text-and-extract-entities', {
		      text: text,
		      username: username,
		      password: password,
		      model: model
		    },
		    function (data) {
		      processResponseFromAnnotator(text, data)
		      hideErrorConnection();
		    }).fail(function(err) {
          alert("Not connected to the NLU service. ")
          checkErrorConnection(err);
        })
   	} else {
			alert('Text field is blank');
   	}
});