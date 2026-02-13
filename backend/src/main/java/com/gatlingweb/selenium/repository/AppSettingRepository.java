package com.gatlingweb.selenium.repository;

import com.gatlingweb.selenium.entity.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppSettingRepository extends JpaRepository<AppSetting, String> {
}
