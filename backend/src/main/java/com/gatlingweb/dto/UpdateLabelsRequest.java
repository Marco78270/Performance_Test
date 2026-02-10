package com.gatlingweb.dto;

import java.util.List;

public record UpdateLabelsRequest(
    List<String> labels
) {}
