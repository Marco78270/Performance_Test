package com.gatlingweb.selenium.dto;

import java.util.List;

public record SeleniumTrendDataDto(
    String scriptClass,
    List<SeleniumTrendPointDto> points
) {}
